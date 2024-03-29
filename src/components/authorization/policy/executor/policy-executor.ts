import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { identity, intersection } from 'lodash';
import { EnhancedResource, Session } from '~/common';
import { QueryFragment } from '~/core/database/query';
import { withoutScope } from '../../dto/role.dto';
import { RoleCondition } from '../../policies/conditions/role.condition';
import { Permission } from '../builder/perm-granter';
import { all, any, CalculatedCondition, OrConditions } from '../conditions';
import { PolicyFactory } from '../policy.factory';
import { ConditionOptimizer } from './condition-optimizer';

export interface ResolveParams {
  action: string;
  session: Session;
  resource: EnhancedResource<any>;
  prop?: string;
  calculatedAsCondition?: boolean;
  optimizeConditions?: boolean;
}

export interface FilterOptions {
  wrapContext?: (next: QueryFragment) => QueryFragment;
}

@Injectable()
export class PolicyExecutor {
  constructor(
    private readonly policyFactory: PolicyFactory,
    @Inject(forwardRef(() => ConditionOptimizer))
    private readonly conditionOptimizer: ConditionOptimizer & {},
  ) {}

  resolve({
    action,
    session,
    resource,
    prop,
    calculatedAsCondition,
    optimizeConditions = false,
  }: ResolveParams): Permission {
    if (action !== 'read') {
      if (prop) {
        if (resource.calculatedProps.has(prop)) {
          return calculatedAsCondition ? CalculatedCondition.instance : false;
        }
      } else if (resource.isCalculated) {
        return calculatedAsCondition ? CalculatedCondition.instance : false;
      }
    }

    const policies = this.getPolicies(session);
    const isChildRelation = prop && resource.childKeys.has(prop);

    const conditions = [];
    for (const policy of policies) {
      const grants = policy.grants.get(resource);
      if (!grants) {
        continue;
      }

      const condition = isChildRelation
        ? grants.childRelations[prop]?.[action]
        : prop
        ? (grants.propLevel[prop] ?? grants.objectLevel)[action]
        : grants.objectLevel[action];

      if (condition == null) {
        continue;
      }
      if (condition === false) {
        // Deny actions should not cross into other policies, continue executing.
        continue;
      }
      if (condition === true) {
        return true;
      }
      conditions.push(condition);
    }
    if (conditions.length === 0) {
      return false;
    }
    const merged = OrConditions.fromAll(conditions, {
      optimize: optimizeConditions,
    });
    return optimizeConditions
      ? this.conditionOptimizer.optimize(merged)
      : merged;
  }

  forEdgeDB({
    action,
    resource,
  }: Pick<ResolveParams, 'action' | 'resource'>): Permission {
    if (action !== 'read' && resource.isCalculated) {
      // users don't initiate calculated actions, so don't block with access policies
      if ([...resource.interfaces].some((e) => e.hasDB)) {
        // But don't duplicate AP if an interface has already declared
        return false;
      }
      return true;
    }

    const policies = this.policyFactory.getDBPolicies();

    const conditions = [];
    for (const policy of policies) {
      const grants = policy.grants.get(resource);
      if (!grants) {
        continue;
      }

      const condition = grants.objectLevel[action];
      if (condition == null) {
        continue;
      }
      if (condition === false) {
        // Deny actions should not cross into other policies, continue executing.
        continue;
      }

      const roleCondition =
        policy.roles && policy.roles.length > 0
          ? new RoleCondition(new Set(policy.roles))
          : undefined;

      if (!roleCondition && condition === true) {
        // globally allowed
        return true;
      }
      conditions.push(
        all(roleCondition, condition !== true ? condition : null),
      );
    }
    if (conditions.length === 0) {
      return false;
    }
    return this.conditionOptimizer.optimize(any(...conditions));
  }

  cypherFilter({
    wrapContext = identity,
    ...params
  }: FilterOptions & ResolveParams): QueryFragment {
    const perm = this.resolve(params);

    return (query) => {
      if (perm === true) {
        // There's no need to check because the user has roles that have global read
        // access without any (unmet) conditions.
        return query;
      }
      if (perm === false) {
        // Under no circumstances is user able to read, so just block everything.
        // Ideally this could be done without round tripping to the DB, but
        // for simplicity its here. Also, I think it's not the normal hot path.
        return query.with('*').raw('WHERE false');
      }

      const other = {
        resource: params.resource,
        session: params.session,
      };
      return query
        .comment("Loading policy condition's context")
        .apply(
          wrapContext(
            (q1) => perm.setupCypherContext?.(q1, new Set(), other) ?? q1,
          ),
        )
        .comment('Filtering by policy conditions')
        .with('*')
        .raw(`WHERE ${perm.asCypherCondition(query, other)}`);
    };
  }

  @CachedByArg({ weak: true })
  getPolicies(session: Session) {
    const policies = this.policyFactory.getPolicies().filter((policy) => {
      if (!policy.roles) {
        return true; // policy doesn't limit roles
      }
      const rolesSpecifiedByPolicyThatUserHas = intersection(
        policy.roles,
        session.roles.map(withoutScope),
      );
      return rolesSpecifiedByPolicyThatUserHas.length > 0;
    });
    return policies;
  }
}
