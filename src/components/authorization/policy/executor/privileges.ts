import { Injectable } from '@nestjs/common';
import { ResourceShape, Session } from '~/common';
import { PolicyExecutor } from './policy-executor';
import { ScopedPrivileges } from './scoped-privileges';
import { UserPrivileges } from './user-privileges';

@Injectable()
export class Privileges {
  constructor(private readonly policyExecutor: PolicyExecutor) {}

  forUser(session: Session) {
    return new UserPrivileges(session, this.policyExecutor);
  }

  /**
   * Returns the privileges given the appropriate user & resource context.
   */
  for<TResourceStatic extends ResourceShape<any>>(
    session: Session,
    resource: TResourceStatic,
    object?: TResourceStatic['prototype']
  ) {
    return new ScopedPrivileges(resource, object, session, this.policyExecutor);
  }
}
