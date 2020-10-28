import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { EngagementCreatedEvent } from '../../engagement/events';
import { CeremonyService } from '../ceremony.service';
import { CeremonyType } from '../dto/type.enum';
import { DbCeremony } from '../model';

@EventsHandler(EngagementCreatedEvent)
export class CreateEngagementDefaultCeremonyHandler
  implements IEventHandler<EngagementCreatedEvent> {
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
    const ceremony = await this.ceremonies.create(input, session);

    // connect ceremony to engagement
    await this.db
      .query()
      .matchNode('engagement', 'Engagement', {
        id: engagement.id,
      })
      .matchNode('ceremony', 'Ceremony', { id: ceremony.id })
      .create([
        node('ceremony'),
        relation('in', 'ceremonyRel', 'ceremony', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('engagement'),
      ])
      .run();

    const dbCeremony = new DbCeremony();
    await this.authorizationService.processNewBaseNode(
      dbCeremony,
      ceremony.id,
      session.userId
    );

    event.engagement = {
      ...engagement,
      ceremony: {
        ...engagement.ceremony, // permissions
        value: ceremony.id,
      },
    };
  }
}
