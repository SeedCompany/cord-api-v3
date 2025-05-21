import { InputException } from '~/common';
import { EventsHandler } from '~/core/events';
import { UserUpdatedEvent } from '../../user/events/user-updated.event';
import { FieldZoneRepository } from '../field-zone.repository';

@EventsHandler(UserUpdatedEvent)
export class RestrictZoneDirectorRemovalHandler {
  constructor(private readonly repo: FieldZoneRepository) {}

  async handle(event: UserUpdatedEvent) {
    if (!event.updated.roles) {
      return;
    }
    const roleRemoved =
      event.previous.roles.includes('FieldOperationsDirector') &&
      !event.updated.roles.includes('FieldOperationsDirector');
    if (!roleRemoved) {
      return;
    }

    const zones = await this.repo.readAllByDirector(event.updated.id);
    if (zones.length > 0) {
      throw new InputException(
        'User is still a director for these field zones:\n' +
          zones.map((z) => `  - ${z.name}`).join('\n'),
      );
    }
  }
}
