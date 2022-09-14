import { Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import { CachedOnArg, EnhancedResource, Session } from '~/common';
import { ILogger, Logger } from '~/core';
import { withoutScope } from '../../dto/role.dto';
import { PolicyFactory } from '../policy.factory';

@Injectable()
export class PolicyExecutor {
  constructor(
    private readonly policyFactory: PolicyFactory,
    @Logger('policy:executor') private readonly logger: ILogger
  ) {}

  execute(
    action: string,
    session: Session,
    resource: EnhancedResource<any>,
    object?: object,
    prop?: string
  ) {
    const policies = this.getPolicies(session);
    const isChildRelation = prop && resource.hasChildRelation(prop);

    for (const policy of policies) {
      const grants = policy.grants.get(resource.type);
      if (!grants) {
        continue;
      }

      const condition = isChildRelation
        ? grants.childRelations[prop]?.[action]
        : prop
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

  @CachedOnArg()
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
