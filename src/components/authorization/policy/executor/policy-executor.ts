import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { identity } from 'lodash';
import { type EnhancedResource } from '~/common';
import { Identity, type Session } from '~/core/authentication';
import { type QueryFragment } from '~/core/database/query';
import { RoleCondition } from '../../policies/conditions/role.condition';
import { type Permission } from '../builder/perm-granter';
import {
  AggregateConditions,
  all,
  AndConditions,
  any,
  CalculatedCondition,
  type Condition,
  OrConditions,
} from '../conditions';
import { visitCondition } from '../conditions/condition-visitor';
import { PolicyFactory } from '../policy.factory';
import { ConditionOptimizer } from './condition-optimizer';

export interface ResolveParams {
  action: string;
  session?: Session;
  resource: EnhancedResource<any>;
  prop?: string;
  calculatedAsCondition?: boolean;
  optimizeConditions?: boolean;
  /**
   * A function to partially resolve conditions.
   */
  conditionResolver?: (condition: Condition) => boolean | undefined;
}

export interface FilterOptions {
  wrapContext?: (next: QueryFragment) => QueryFragment;
}

@Injectable()
export class PolicyExecutor {
  constructor(
    readonly identity: Identity,
    private readonly policyFactory: PolicyFactory,
    @Inject(forwardRef(() => ConditionOptimizer))
    private readonly conditionOptimizer: ConditionOptimizer & {},
  ) {}

  resolve({
    action,
    resource,
    prop,
    calculatedAsCondition,
    optimizeConditions = false,
    conditionResolver,
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

    const session = this.identity.current;
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
    let condition = OrConditions.fromAll(conditions, {
      optimize: optimizeConditions,
    });
    if (conditionResolver) {
      const resolved = this.partialResolve(condition, conditionResolver);
      if (typeof resolved === 'boolean') {
        return resolved;
      }
      condition = resolved;
    }
    if (optimizeConditions) {
      condition = this.conditionOptimizer.optimize(condition);
    }
    return condition;
  }

  forGel({
    action,
    resource,
  }: Pick<ResolveParams, 'action' | 'resource'>): Permission {
    const isDerivedInDB = [...resource.interfaces].some((e) => e.hasDB);

    if (action !== 'read' && resource.isCalculated) {
      // users don't initiate calculated actions, so don't block with access policies
      // But don't duplicate AP if an interface has already declared
      return !isDerivedInDB;
    }

    // let app handle edit permissions
    if (action === 'edit') {
      return !isDerivedInDB;
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
        policy.roles && policy.roles.size > 0
          ? new RoleCondition(policy.roles)
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
        session: this.identity.current,
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

  private partialResolve(
    condition: Condition,
    resolver: (condition: Condition) => boolean | undefined,
  ): Permission {
    const partialResolutions = new Map<Condition, boolean>();
    visitCondition(condition, (cc) => {
      const result = resolver(cc);
      if (result != null) {
        partialResolutions.set(cc, result);
      }
    });

    const walkAndReform = (c: Condition): Permission => {
      if (partialResolutions.has(c)) {
        return partialResolutions.get(c)!;
      }

      if (!(c instanceof AggregateConditions)) {
        return c;
      }

      let changed = Boolean(false);
      const children = c.conditions.map((sub) => {
        const next = walkAndReform(sub);
        if (next !== sub) {
          changed = true;
        }
        return next;
      });
      // Only change aggregate identity if children have changed
      if (!changed) {
        return c;
      }
      if (c instanceof AndConditions) {
        // a && b && c
        // a && false && true = false
        if (children.some((perm) => perm === false)) {
          return false;
        }
        const remainingConditions = children.filter(
          (perm): perm is Condition => perm !== true,
        );
        // true && true && true = true
        if (remainingConditions.length === 0) {
          // no children were false, no children were conditions
          // aka all children are true
          return true;
        }
        // a && true && true = a
        return all(...remainingConditions);
      } else {
        // a || b || c
        // a || false || true = true
        if (children.some((perm) => perm === true)) {
          return true;
        }
        const remainingConditions = children.filter(
          (perm): perm is Condition => perm !== false,
        );
        // false || false || false = false
        if (remainingConditions.length === 0) {
          // no children were true, no children were conditions
          // aka all children are false
          return false;
        }
        // a || false || false = a
        return any(...remainingConditions);
      }
    };
    return walkAndReform(condition);
  }

  @CachedByArg({ weak: true })
  getPolicies(session: Session) {
    const policies = this.policyFactory.getPolicies().filter((policy) => {
      if (!policy.roles) {
        return true; // policy doesn't limit roles
      }
      const rolesSpecifiedByPolicyThatUserHas = policy.roles.intersection(
        session.roles,
      );
      return rolesSpecifiedByPolicyThatUserHas.size > 0;
    });
    return policies;
  }
}
