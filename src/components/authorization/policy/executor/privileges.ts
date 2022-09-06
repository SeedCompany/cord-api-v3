import { Injectable } from '@nestjs/common';
import { ResourceShape, Session } from '~/common';
import { PolicyExecutor } from './policy-executor';
import { ResourcePrivileges } from './resource-privileges';

@Injectable()
export class Privileges {
  constructor(private readonly policyExecutor: PolicyExecutor) {}

  /**
   * Returns the privileges given the appropriate user & resource context.
   */
  for<TResourceStatic extends ResourceShape<any>>(
    session: Session,
    resource: TResourceStatic,
    object?: TResourceStatic['prototype']
  ) {
    return new ResourcePrivileges(
      resource,
      object,
      session,
      this.policyExecutor
    );
  }
}
