import { lowerCase } from 'lodash';
import { ResourceShape, Session, UnauthorizedException } from '~/common';
import { Action } from '../builder/perm-granter';
import { ResourceProps } from '../builder/prop-granter';
import { PolicyExecutor } from './policy-executor';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    private readonly resource: TResourceStatic,
    private readonly object: TResourceStatic['prototype'] | undefined,
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  can(action: Action, prop?: ResourceProps<TResourceStatic>) {
    return this.policyExecutor.execute(
      action,
      this.session,
      this.resource,
      this.object,
      prop
    );
  }

  verifyCan(action: Action, prop?: ResourceProps<TResourceStatic>) {
    if (!this.can(action, prop)) {
      throw new UnauthorizedException(
        `You do not have the permission to ${action} ${
          this.object ? 'this' : 'any'
        } ${lowerCase(this.resource.name)}${prop ? '.' + prop : ''}`
      );
    }
  }
}
