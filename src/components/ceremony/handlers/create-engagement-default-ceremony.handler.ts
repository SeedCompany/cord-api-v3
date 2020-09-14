import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { EngagementCreatedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';
import { CeremonyType } from '../dto/type.enum';

@EventsHandler(EngagementCreatedEvent)
export class CreateEngagementDefaultCeremonyHandler
  implements IEventHandler<EngagementCreatedEvent> {
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService
  ) {}

  async handle({ engagement, session }: EngagementCreatedEvent) {
    const input = {
      type:
        engagement.__typename === 'LanguageEngagement'
          ? CeremonyType.Dedication
          : CeremonyType.Certification,
    };
    const ceremony = await this.ceremonies.create(input, session);

    // connect ceremony to engagement
    await this.db
      .query()
      .matchNode('engagement', 'Engagement', {
        id: engagement.id,
        active: true,
      })
      .matchNode('ceremony', 'Ceremony', { id: ceremony.id, active: true })
      .create([
        node('ceremony'),
        relation('in', 'ceremonyRel', 'ceremony', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('engagement'),
      ])
      .run();
  }
}
