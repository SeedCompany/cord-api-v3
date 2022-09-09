import { ResourceShape, Session } from '~/common';
import { PolicyExecutor } from './policy-executor';
import { ScopedPrivileges } from './scoped-privileges';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    private readonly resource: TResourceStatic,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  for(session: Session, object?: TResourceStatic['prototype']) {
    return new ScopedPrivileges(
      this.resource,
      object,
      session,
      this.policyExecutor
    );
  }
}
