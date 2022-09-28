import { EnhancedResource, ResourceShape, Session } from '~/common';
import { ResourceObjectContext } from '../object.type';
import { PolicyExecutor } from './policy-executor';
import { UserEdgePrivileges } from './user-edge-privileges';

export class EdgePrivileges<
  TResourceStatic extends ResourceShape<any>,
  TKey extends string,
  TAction extends string
> {
  private readonly resource: EnhancedResource<TResourceStatic>;
  constructor(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    private readonly key: TKey,
    private readonly policyExecutor: PolicyExecutor
  ) {
    this.resource = EnhancedResource.of(resource);
  }

  forUser(session: Session, object?: ResourceObjectContext<TResourceStatic>) {
    return new UserEdgePrivileges<TResourceStatic, TKey, TAction>(
      this.resource,
      this.key,
      object,
      session,
      this.policyExecutor
    );
  }
}
