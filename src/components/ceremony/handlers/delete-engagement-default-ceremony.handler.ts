import { ConfigService, EventsHandler, type IEventHandler } from '~/core';
import { EngagementWillDeleteEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';

@EventsHandler(EngagementWillDeleteEvent)
export class DetachEngagementRootDirectoryHandler
  implements IEventHandler<EngagementWillDeleteEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly config: ConfigService,
  ) {}

  async handle({ engagement }: EngagementWillDeleteEvent) {
    if (this.config.databaseEngine === 'gel') {
      return;
    }

    const ceremonyId = engagement.ceremony.value?.id;
    if (!ceremonyId) {
      return;
    }

    // TODO Ceremony should be changeset aware
    if (engagement.changeset) {
      return;
    }

    await this.ceremonies.delete(ceremonyId);
  }
}
