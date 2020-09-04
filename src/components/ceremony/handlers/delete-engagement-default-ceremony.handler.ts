import { node, relation } from 'cypher-query-builder';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { EngagementDeletedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';

@EventsHandler(EngagementDeletedEvent)
export class DetachEngagementRootDirectoryHandler
  implements IEventHandler<EngagementDeletedEvent> {
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService
  ) {}

  async handle({ engagement, session }: EngagementDeletedEvent) {
    const ceremonyId = engagement?.ceremony?.value;

    if (ceremonyId) {
      await this.ceremonies.delete(ceremonyId, session);

      this.db
        .query()
        .matchNode('engagement', 'Engagement', {
          id: engagement.id,
          active: true,
        })
        .matchNode('ceremony', 'Ceremony', { id: ceremonyId, active: true })
        .match([
          node('ceremony'),
          relation('in', 'ceremonyRel', 'ceremony', {
            active: true,
          }),
          node('engagement'),
        ])
        .delete('ceremonyRel');
    }
  }
}
