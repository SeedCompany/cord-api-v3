import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  ResourceShape,
  SecuredPropsPlusExtraKey,
  Session,
} from '~/common';
import { Powers as Power } from '../../dto/powers';
import { MissingPowerException } from '../../missing-power.exception';
import { ChildListAction, ChildSingleAction, PropAction } from '../actions';
import { ResourceObjectContext } from '../object.type';
import { PolicyExecutor } from './policy-executor';
import { UserEdgePrivileges } from './user-edge-privileges';
import { UserResourcePrivileges } from './user-resource-privileges';

export class UserPrivileges {
  constructor(
    readonly session: Session,
    private readonly policyExecutor: PolicyExecutor,
  ) {}

  forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ) {
    return new UserResourcePrivileges(
      resource,
      object,
      this.session,
      this.policyExecutor,
    );
  }

  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: SecuredPropsPlusExtraKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    SecuredPropsPlusExtraKey<TResourceStatic>,
    PropAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildSinglesKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    ChildSinglesKey<TResourceStatic>,
    ChildSingleAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildListsKey<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>,
  ): UserEdgePrivileges<
    TResourceStatic,
    ChildListsKey<TResourceStatic>,
    ChildListAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: string,
    object?: ResourceObjectContext<TResourceStatic>,
  ) {
    return new UserEdgePrivileges(
      resource,
      key,
      object,
      this.session,
      this.policyExecutor,
    );
  }

  /**
   * I think this should be replaced in app code with `.for(X).verifyCan('create')`
   */
  verifyPower(power: Power) {
    if (!this.powers.has(power)) {
      throw new MissingPowerException(
        power,
        `User ${
          this.session.anonymous ? 'anon' : this.session.userId
        } does not have the requested power: ${power}`,
      );
    }
  }

  get powers(): Set<Power> {
    const policies = this.policyExecutor.getPolicies(this.session);
    return new Set(policies.flatMap((policy) => [...policy.powers]));
  }
}
