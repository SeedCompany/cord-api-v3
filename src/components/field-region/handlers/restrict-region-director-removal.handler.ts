import { InputException } from '~/common';
import { EventsHandler } from '~/core/events';
import { UserUpdatedEvent } from '../../user/events/user-updated.event';
import { FieldRegionRepository } from '../field-region.repository';

@EventsHandler(UserUpdatedEvent)
export class RestrictRegionDirectorRemovalHandler {
  constructor(private readonly repo: FieldRegionRepository) {}

  async handle(event: UserUpdatedEvent) {
    if (!event.updated.roles) {
      return;
    }
    const roleRemoved =
      event.previous.roles.includes('RegionalDirector') &&
      !event.updated.roles.includes('RegionalDirector');
    if (!roleRemoved) {
      return;
    }

    const regions = await this.repo.readAllByDirector(event.updated.id);
    if (regions.length > 0) {
      throw new InputException(
        'User is still a director for these field regions:\n' +
          regions.map((z) => `  - ${z.name}`).join('\n'),
      );
    }
  }
}
