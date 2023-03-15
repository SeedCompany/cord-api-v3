import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { EngagementWillDeleteEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';

@EventsHandler(EngagementWillDeleteEvent)
export class DetachEngagementRootDirectoryHandler
  implements IEventHandler<EngagementWillDeleteEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService,
  ) {}

  async handle({ engagement, session }: EngagementWillDeleteEvent) {
    const ceremonyId = engagement?.ceremony?.value;
    if (!ceremonyId) {
      return;
    }

    // TODO Ceremony should be changeset aware
    if (engagement.changeset) {
      return;
    }

    await this.ceremonies.delete(ceremonyId, session);
  }
}
