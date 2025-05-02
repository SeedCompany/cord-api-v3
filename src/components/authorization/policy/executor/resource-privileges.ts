import {
  type ChildListsKey,
  type ChildSinglesKey,
  type EnhancedResource,
  type ResourceShape,
  type SecuredPropsPlusExtraKey,
  type Session,
} from '~/common';
import {
  type ChildListAction,
  type ChildSingleAction,
  type PropAction,
} from '../actions';
import { type ResourceObjectContext } from '../object.type';
import { EdgePrivileges } from './edge-privileges';
import { type PolicyExecutor } from './policy-executor';
import { UserResourcePrivileges } from './user-resource-privileges';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    readonly resource: EnhancedResource<TResourceStatic>,
    private readonly policyExecutor: PolicyExecutor,
  ) {}

  forUser(session: Session, object?: ResourceObjectContext<TResourceStatic>) {
    return new UserResourcePrivileges(
      this.resource,
      object,
      session,
      this.policyExecutor,
    );
  }

  forEdge(
    key: SecuredPropsPlusExtraKey<TResourceStatic>,
  ): EdgePrivileges<
    TResourceStatic,
    SecuredPropsPlusExtraKey<TResourceStatic>,
    PropAction
  >;
  forEdge(
    key: ChildSinglesKey<TResourceStatic>,
  ): EdgePrivileges<
    TResourceStatic,
    ChildSinglesKey<TResourceStatic>,
    ChildSingleAction
  >;
  forEdge(
    key: ChildListsKey<TResourceStatic>,
  ): EdgePrivileges<
    TResourceStatic,
    ChildListsKey<TResourceStatic>,
    ChildListAction
  >;
  forEdge(key: string) {
    return new EdgePrivileges(this.resource, key, this.policyExecutor);
  }
}
