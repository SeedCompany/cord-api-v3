import { Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import { ResourceShape, Session } from '~/common';
import { ILogger, Logger } from '~/core';
import { withoutScope } from '../../dto/role.dto';
import { ResourceMap } from '../../model/resource-map';
import { Action } from '../builder/perm-granter';
import { PolicyFactory } from '../policy.factory';

@Injectable()
export class PolicyExecutor {
  constructor(
    private readonly policyFactory: PolicyFactory,
    @Logger('policy:executor') private readonly logger: ILogger
  ) {}

  execute(
    action: Action,
    session: Session,
    resource: ResourceShape<any>,
    object?: object,
    prop?: string
  ) {
    const policies = this.getPolicies(session);

    for (const policy of policies) {
      const grants = policy.grants.get(resource.name as keyof ResourceMap);
      if (!grants) {
        continue;
      }

      const condition = prop
        ? grants.propLevel[prop]?.[action] ?? grants.objectLevel[action]
        : grants.objectLevel[action];

      if (!condition) {
        continue;
      }
      if (condition === true) {
        return true;
      }
      if (condition.isAllowed({ policy, object, resource })) {
        return true;
      }
    }
    return false;
  }

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
