import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { EngagementCreatedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';
import { Ceremony } from '../dto';
import { CeremonyType } from '../dto/type.enum';

@EventsHandler(EngagementCreatedEvent)
export class CreateEngagementDefaultCeremonyHandler
  implements IEventHandler<EngagementCreatedEvent>
{
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService
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

    await this.authorizationService.processNewBaseNode(
      Ceremony,
      ceremonyId,
      session.userId
    );

    event.engagement = {
      ...engagement,
      ceremony: {
        ...engagement.ceremony, // permissions
        value: ceremonyId,
      },
    };
  }
}
