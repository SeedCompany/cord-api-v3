import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { collect } from '../../../core/database/query';
import { EngagementService } from '../../engagement';
import {
  InternshipEngagement,
  LanguageEngagement,
} from '../../engagement/dto/engagement.dto';
import { EngagementRepository } from '../../engagement/engagement.repository';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class ApplyApprovedChangesetToEngagement
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly engagementService: EngagementService,
    private readonly engagementRepo: EngagementRepository,
    @Logger('engagement:change-request:approved')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changesetId = event.changeRequest.id;

    try {
      // Get related project Id
      const result = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changesetId }),
        ])
        .return('project.id as projectId')
        .asResult<{ projectId: ID }>()
        .first();

      if (result?.projectId) {
        // Update project engagement pending changes
        await this.db
          .query()
          .match([node('changeset', 'Changeset', { id: changesetId })])
          .match([
            node('project', 'Project', { id: result.projectId }),
            relation('out', 'engagementRel', 'engagement', { active: false }),
            node('engagement', 'Engagement'),
            relation('in', 'changesetRel', 'changeset', { active: true }),
            node('changeset'),
          ])
          .setValues({
            'engagementRel.active': true,
            'changesetRel.active': false,
          })
          .run();
        const engagementsResult = await this.db
          .query()
          .match([
            node('project', 'Project', { id: result.projectId }),
            relation('out', '', 'engagement', { active: true }),
            node('engagement', 'Engagement'),
          ])
          .return(collect('engagement.id', 'engagementIds'))
          .asResult<{ engagementIds: ID[] }>()
          .first();

        if (engagementsResult?.engagementIds) {
          await Promise.all(
            engagementsResult.engagementIds.map(async (id) => {
              const object = await this.engagementService.readOne(
                id,
                event.session
              );
              const changes = await this.engagementRepo.getChangesetProps(
                id,
                changesetId
              );
              await this.db.updateProperties({
                type: LanguageEngagement || InternshipEngagement,
                object,
                changes,
              });
            })
          );
        }
      }
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
