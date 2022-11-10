import { Injectable } from '@nestjs/common';
import { identity, intersection } from 'lodash';
import { CachedForArg, EnhancedResource, Session } from '~/common';
import { QueryFragment } from '~/core/database/query';
import { withoutScope } from '../../dto/role.dto';
import { Permission } from '../builder/perm-granter';
import { any, Condition } from '../conditions';
import { PolicyFactory } from '../policy.factory';

export interface ResolveParams {
  action: string;
  session: Session;
  resource: EnhancedResource<any>;
  prop?: string;
  calculatedAsCondition?: boolean;
}

export interface FilterOptions {
  wrapContext?: (next: QueryFragment) => QueryFragment;
}

@Injectable()
export class PolicyExecutor {
  constructor(private readonly policyFactory: PolicyFactory) {}

  resolve({
    action,
    session,
    resource,
    prop,
    calculatedAsCondition,
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

    if (isChildRelation) {
      return (
        this.resolvePermission(
          policies.map((policy) => {
            return policy.grants.get(resource)?.childRelations[prop]?.[action];
          })
        ) ?? false
      );
    }

    if (prop) {
      const resolved = this.resolvePermission(
        policies.map((policy) => {
          return policy.grants.get(resource)?.propLevel[prop]?.[action];
        })
      );
      if (resolved != null) {
        return resolved;
      }
      // fall through to resource level
    }

    return (
      this.resolvePermission(
        policies.map((policy) => {
          return policy.grants.get(resource)?.objectLevel[action];
        })
      ) ?? false
    );
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
            (q1) => perm.setupCypherContext?.(q1, new Set(), other) ?? q1
          )
        )
        .comment('Filtering by policy conditions')
        .with('*')
        .raw(`WHERE ${perm.asCypherCondition(query, other)}`);
    };
  }

  private resolvePermission(
    permissions: ReadonlyArray<Permission | undefined>
  ): Permission | undefined {
    return this.policyFactory.mergePermission(permissions, any, [
      // 'deny', // Deny actions should not cross into other policies, ignoring.
      'allow',
      'conditional',
    ]);
  }

  @CachedForArg({ weak: true })
  getPolicies(session: Session) {
    const policies = this.policyFactory.getPolicies().filter((policy) => {
      if (!policy.roles) {
        return true; // policy doesn't limit roles
      }
      const rolesSpecifiedByPolicyThatUserHas = intersection(
        policy.roles,
        session.roles.map(withoutScope)
      );
      return rolesSpecifiedByPolicyThatUserHas.length > 0;
    });
    return policies;
  }
}

export class CalculatedCondition implements Condition<any> {
  static readonly instance = new CalculatedCondition();
  isAllowed() {
    return false;
  }
  asCypherCondition() {
    return 'false';
  }
}
