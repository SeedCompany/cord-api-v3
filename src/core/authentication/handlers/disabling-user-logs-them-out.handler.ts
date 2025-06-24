import { EventsHandler } from '~/core';
import { UserUpdatedEvent } from '../../../components/user/events/user-updated.event';
import { AuthenticationService } from '../authentication.service';

@EventsHandler(UserUpdatedEvent)
export class DisablingUserLogsThemOutHandler {
  constructor(private readonly auth: AuthenticationService) {}
  async handle({ input, updated: user }: UserUpdatedEvent) {
    if (input.status === 'Disabled') {
      await this.auth.logoutByUser(user.id);
    }
  }
}
