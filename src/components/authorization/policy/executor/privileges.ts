import { Injectable } from '@nestjs/common';
import {
  type ChildListsKey,
  type ChildSinglesKey,
  EnhancedResource,
  type ResourceShape,
  type SecuredPropsPlusExtraKey,
} from '~/common';
import { Identity } from '~/core/authentication';
import type { Power } from '../../dto';
import { MissingPowerException } from '../../missing-power.exception';
import { type ChildListAction, type ChildSingleAction, type PropAction } from '../actions';
import { type ResourceObjectContext } from '../object.type';
import { EdgePrivileges } from './edge-privileges';
import { PolicyExecutor } from './policy-executor';
import { ResourcePrivileges } from './resource-privileges';

@Injectable()
export class Privileges {
  constructor(
    private readonly policyExecutor: PolicyExecutor,
    private readonly identity: Identity,
  ) {}

  forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  ) {
    return new ResourcePrivileges<TResourceStatic>(
      EnhancedResource.of(resource),
      undefined,
      this.policyExecutor,
    );
  }

  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: SecuredPropsPlusExtraKey<TResourceStatic>,
  ): EdgePrivileges<TResourceStatic, SecuredPropsPlusExtraKey<TResourceStatic>, PropAction>;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildSinglesKey<TResourceStatic>,
  ): EdgePrivileges<TResourceStatic, ChildSinglesKey<TResourceStatic>, ChildSingleAction>;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildListsKey<TResourceStatic>,
  ): EdgePrivileges<TResourceStatic, ChildListsKey<TResourceStatic>, ChildListAction>;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: string,
  ) {
    return new EdgePrivileges(EnhancedResource.of(resource), key, undefined, this.policyExecutor);
  }

  /**
   * Returns the privileges given the appropriate user & resource context.
   */
  for<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    object?: NoInfer<ResourceObjectContext<TResourceStatic>>,
  ) {
    return new ResourcePrivileges<TResourceStatic>(resource, object, this.policyExecutor);
  }

  /**
   * I think this should be replaced in-app code with `.for(X).verifyCan('create')`
   */
  verifyPower(power: Power) {
    const session = this.identity.current;
    if (!this.powers.has(power)) {
      throw new MissingPowerException(
        power,
        `User ${
          session.anonymous ? 'anon' : session.userId
        } does not have the requested power: ${power}`,
      );
    }
  }

  get powers(): Set<Power> {
    const session = this.identity.current;
    const policies = this.policyExecutor.getPolicies(session);
    return new Set(policies.flatMap((policy) => [...policy.powers]));
  }
}
