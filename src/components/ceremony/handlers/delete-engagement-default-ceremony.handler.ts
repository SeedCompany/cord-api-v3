import { EventsHandler, IEventHandler } from '~/core';
import { EngagementWillDeleteEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';

@EventsHandler(EngagementWillDeleteEvent)
export class DetachEngagementRootDirectoryHandler
  implements IEventHandler<EngagementWillDeleteEvent>
{
  constructor(private readonly ceremonies: CeremonyService) {}

  async handle({ engagement, session }: EngagementWillDeleteEvent) {
    const ceremony = engagement?.ceremony?.value;
    if (!ceremony) {
      return;
    }

    // TODO Ceremony should be changeset aware
    if (engagement.changeset) {
      return;
    }

    await this.ceremonies.delete(ceremony.id, session);
  }
}
