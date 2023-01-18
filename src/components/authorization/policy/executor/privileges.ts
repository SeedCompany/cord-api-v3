import { Injectable } from '@nestjs/common';
import {
  ChildListsKey,
  ChildSinglesKey,
  EnhancedResource,
  ResourceShape,
  SecuredPropsPlusExtraKey,
  Session,
} from '~/common';
import { ChildListAction, ChildSingleAction, PropAction } from '../actions';
import { ResourceObjectContext } from '../object.type';
import { EdgePrivileges } from './edge-privileges';
import { PolicyExecutor } from './policy-executor';
import { ResourcePrivileges } from './resource-privileges';
import { UserPrivileges } from './user-privileges';
import { UserResourcePrivileges } from './user-resource-privileges';

@Injectable()
export class Privileges {
  constructor(private readonly policyExecutor: PolicyExecutor) {}

  forUser(session: Session) {
    return new UserPrivileges(session, this.policyExecutor);
  }

  forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>
  ) {
    return new ResourcePrivileges<TResourceStatic>(
      EnhancedResource.of(resource),
      this.policyExecutor
    );
  }

  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: SecuredPropsPlusExtraKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    SecuredPropsPlusExtraKey<TResourceStatic>,
    PropAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildSinglesKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    ChildSinglesKey<TResourceStatic>,
    ChildSingleAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: ChildListsKey<TResourceStatic>
  ): EdgePrivileges<
    TResourceStatic,
    ChildListsKey<TResourceStatic>,
    ChildListAction
  >;
  forEdge<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    key: string
  ) {
    return new EdgePrivileges(
      EnhancedResource.of(resource),
      key,
      this.policyExecutor
    );
  }

  /**
   * Returns the privileges given the appropriate user & resource context.
   */
  for<TResourceStatic extends ResourceShape<any>>(
    session: Session,
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    object?: ResourceObjectContext<TResourceStatic>
  ) {
    return new UserResourcePrivileges<TResourceStatic>(
      resource,
      object,
      session,
      this.policyExecutor
    );
  }
}
