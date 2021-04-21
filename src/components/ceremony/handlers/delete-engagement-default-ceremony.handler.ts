import { node, relation } from 'cypher-query-builder';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { EngagementWillDeleteEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';

@EventsHandler(EngagementWillDeleteEvent)
export class DetachEngagementRootDirectoryHandler
  implements IEventHandler<EngagementWillDeleteEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService
  ) {}

  async handle({ engagement, session }: EngagementWillDeleteEvent) {
    const ceremonyId = engagement?.ceremony?.value;
    if (!ceremonyId) {
      return;
    }

    await this.ceremonies.delete(ceremonyId, session);

    await this.db
      .query()
      .matchNode('engagement', 'Engagement', {
        id: engagement.id,
      })
      .matchNode('ceremony', 'Ceremony', { id: ceremonyId })
      .match([
        node('ceremony'),
        relation('in', 'ceremonyRel', 'ceremony', {
          active: true,
        }),
        node('engagement'),
      ])
      .setValues({
        'ceremonyRel.active': false,
      })
      .run();
  }
}
