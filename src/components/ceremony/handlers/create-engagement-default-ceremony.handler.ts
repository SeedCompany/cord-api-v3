import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ConfigService, EventsHandler, IEventHandler } from '~/core';
import { DatabaseService } from '~/core/database';
import { LanguageEngagement } from '../../engagement/dto';
import { EngagementCreatedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';
import { CeremonyType } from '../dto';

@EventsHandler(EngagementCreatedEvent)
export class CreateEngagementDefaultCeremonyHandler
  implements IEventHandler<EngagementCreatedEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {}

  async handle(event: EngagementCreatedEvent) {
    const { engagement } = event;
    const input = {
      type:
        LanguageEngagement.resolve(engagement) === LanguageEngagement
          ? CeremonyType.Dedication
          : CeremonyType.Certification,
    };
    if (this.config.databaseEngine === 'gel') {
      return;
    }
    const ceremonyId = await this.ceremonies.create(input);

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
      ceremony: { id: ceremonyId },
    };
  }
}
