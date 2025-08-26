import { Injectable } from '@nestjs/common';
import { CanImpersonateHook } from '~/core/authentication/hooks/can-impersonate.hook';
import { OnHook } from '~/core/hooks';
import { AssignableRoles } from '../dto/assignable-roles.dto';
import { Privileges } from '../policy';

@Injectable()
export class CanImpersonateViaPrivilegesHandler {
  constructor(private readonly privileges: Privileges) {}

  @OnHook(CanImpersonateHook)
  canImpersonate({ session, allow }: CanImpersonateHook) {
    const p = this.privileges.for(AssignableRoles);
    const granted = session.roles.values().every((role) => p.can('edit', role));
    allow.vote(granted);
  }
}
