import { CanImpersonateEvent } from '~/core/authentication/events/can-impersonate.event';
import { EventsHandler } from '~/core/events';
import { AssignableRoles } from '../dto/assignable-roles.dto';
import { Privileges } from '../policy';

@EventsHandler(CanImpersonateEvent)
export class CanImpersonateHandler {
  constructor(private readonly privileges: Privileges) {}

  handle(event: CanImpersonateEvent) {
    const p = this.privileges.for(AssignableRoles);
    const valid = event.session.roles.values().every((role) => p.can('edit', role));
    event.allow.vote(valid);
  }
}
