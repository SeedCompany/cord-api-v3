import { Injectable } from '@nestjs/common';
import { EnhancedResource, ResourceShape, Session } from '~/common';
import { PolicyExecutor } from './policy-executor';
import { ResourcePrivileges } from './resource-privileges';
import { ScopedPrivileges } from './scoped-privileges';
import { UserPrivileges } from './user-privileges';

@Injectable()
export class Privileges {
  constructor(private readonly policyExecutor: PolicyExecutor) {}

  forUser(session: Session) {
    return new UserPrivileges(session, this.policyExecutor);
  }

  forResource<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>
  ) {
    return new ResourcePrivileges(
      EnhancedResource.of(resource),
      this.policyExecutor
    );
  }

  /**
   * Returns the privileges given the appropriate user & resource context.
   */
  for<TResourceStatic extends ResourceShape<any>>(
    session: Session,
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    object?: TResourceStatic['prototype']
  ) {
    return new ScopedPrivileges(resource, object, session, this.policyExecutor);
  }
}
