import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { groupBy, mapValues, setOf, simpleSwitch } from '@seedcompany/common';
import { startCase } from 'lodash';
import { EnhancedResource, Role, Session } from '~/common';
import { ResourceAction } from './actions';
import { CalculatedCondition, eqlDoesIntersect } from './conditions';
import { PolicyExecutor } from './executor/policy-executor';

@Injectable()
export class EdgeDBAccessPolicyGenerator {
  constructor(
    @Inject(forwardRef(() => PolicyExecutor))
    private readonly executor: PolicyExecutor & {},
  ) {}

  makeSdl(resource: EnhancedResource<any>) {
    const actions: ResourceAction[] = [
      'read',
      'create',
      // 'edit', // need fine grain; will handle at app level
      'delete',
    ];

    const policies = actions.flatMap(
      (action) => this.makeSdlForAction(resource, action) ?? [],
    );
    return policies.length === 0 ? null : policies.join('\n');
  }

  makeSdlForAction(resource: EnhancedResource<any>, action: ResourceAction) {
    const name = `Can${startCase(action)}GeneratedFromAppPoliciesFor${
      resource.name
    }`;

    const byRole = mapValues.fromList(Role, (role: Role) => {
      // @ts-expect-error yeah faked. I think this will be refactored soon.
      const session: Session = { roles: [`global:${role}`] };
      return this.executor.resolve({
        session,
        resource,
        action,
        optimizeConditions: true,
        calculatedAsCondition: true,
      });
    }).asMap;

    // If action is calculated, skip the access policy.
    if (byRole.get(Role.Administrator) === CalculatedCondition.instance) {
      return null;
    }

    const eqlByRole = groupBy(byRole, ([_, perm]) => perm)
      .map((group) => ({
        roles: group.map(([role]) => role),
        perm: group[0][1],
      }))
      .flatMap(({ roles, perm }) => {
        if (perm === false) {
          // Implicit with other access policies
          return [];
        }
        const allRoles = setOf(roles).size === Role.values.size;
        const roleExp = allRoles
          ? undefined
          : eqlDoesIntersect(
              'default::currentUser.roles',
              roles,
              'default::Role',
            );
        return perm === true
          ? roleExp ?? []
          : roleExp
          ? `(${roleExp} and ${perm.asEdgeQLCondition({ resource })})`
          : perm.asEdgeQLCondition({ resource });
      });

    const usingBodyEql = [
      // Always allow adhoc access for outside of API usage.
      'not exists default::currentUser',
      ...eqlByRole,
    ].join('\n    or ');

    const stmtType = simpleSwitch(action, {
      read: 'select',
      create: 'insert',
      delete: 'delete',
      edit: 'update',
    });

    const usingEql = ` using (\n  ${usingBodyEql}\n)`;
    const sdl = `access policy ${name}\nallow ${stmtType}${usingEql};`;
    return sdl;
  }
}
