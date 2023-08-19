import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { EngagementCreatedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';
import { CeremonyType } from '../dto/type.enum';

@EventsHandler(EngagementCreatedEvent)
export class CreateEngagementDefaultCeremonyHandler
  implements IEventHandler<EngagementCreatedEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService,
  ) {}

  async handle(event: EngagementCreatedEvent) {
    const { engagement, session } = event;
    const input = {
      type:
        engagement.__typename === 'LanguageEngagement'
          ? CeremonyType.Dedication
          : CeremonyType.Certification,
    };
    const ceremonyId = await this.ceremonies.create(input, session);

    // connect ceremonyId to engagement
    await this.db
      .query()
      .matchNode('engagement', 'Engagement', {
        id: engagement.id,
      })
      .matchNode('ceremony', 'Ceremony', { id: ceremonyId })
      .create([
        node('ceremony'),
        relation('in', 'ceremonyRel', 'ceremony', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('engagement'),
      ])
      .run();

    event.engagement = {
      ...engagement,
      ceremony: ceremonyId,
    };
  }
}
