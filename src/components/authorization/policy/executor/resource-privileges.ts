import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  ResourceShape,
  SecuredPropsPlusExtraKey,
  Session,
} from '~/common';
import { ChildListAction, ChildSingleAction, PropAction } from '../actions';
import { EdgePrivileges } from './edge-privileges';
import { PolicyExecutor } from './policy-executor';
import { UserResourcePrivileges } from './user-resource-privileges';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    private readonly resource: EnhancedResource<TResourceStatic>,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  forUser(session: Session, object?: TResourceStatic['prototype']) {
    return new UserResourcePrivileges(
      this.resource,
      object,
      session,
      this.policyExecutor
    );
  }

  forEdge(
    key: SecuredPropsPlusExtraKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    SecuredPropsPlusExtraKey<TResourceStatic>,
    PropAction
  >;
  forEdge(
    key: ChildSinglesKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    ChildSinglesKey<TResourceStatic>,
    ChildSingleAction
  >;
  forEdge(
    key: ChildListsKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    ChildListsKey<TResourceStatic>,
    ChildListAction
  >;
  forEdge(key: string) {
    return new EdgePrivileges(this.resource, key, this.policyExecutor);
  }
}
