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
import { LanguageEngagement } from '../../engagement/dto/engagement.dto';
import { EngagementRepository } from '../../engagement/engagement.repository';
import { UpdateProject } from '../../project';
import { ProjectRepository } from '../../project/project.repository';
import { ProjectService } from '../../project/project.service';
import { ProjectChangeRequestStatus } from '../dto';
import { ProjectChangeRequestUpdatedEvent } from '../events';

type SubscribedEvent = ProjectChangeRequestUpdatedEvent;

@EventsHandler(ProjectChangeRequestUpdatedEvent)
export class ApplyApprovedChangesetToProject
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    private readonly projectRepo: ProjectRepository,
    private readonly engagementService: EngagementService,
    private readonly engagementRepo: EngagementRepository,
    @Logger('project:change-request:approved') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug(
      'Project Change Request mutation, update project fields',
      {
        ...event,
        event: event.constructor.name,
      }
    );
    const updated = event.updated;

    if (
      event.previous.status.value !== ProjectChangeRequestStatus.Pending ||
      updated.status.value !== ProjectChangeRequestStatus.Approved
    ) {
      return;
    }

    try {
      // Get related project Id
      const result = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: updated.id }),
        ])
        .return('project.id as projectId')
        .asResult<{ projectId: ID }>()
        .first();

      // Get unsecured project with changeset
      if (result?.projectId) {
        const project = await this.projectService.readOne(
          result.projectId,
          event.session
        );
        const changes = await this.projectRepo.getChangesetProps(
          result.projectId,
          updated.id
        );

        // Update project pending changes
        const updateProject: UpdateProject = {
          ...changes,
          id: project.id,
        };
        await this.projectService.update(
          updateProject,
          event.session,
          undefined,
          false
        );

        // Update project engagement pending changes
        await this.db
          .query()
          .match([node('changeset', 'Changeset', { id: updated.id })])
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

        engagementsResult?.engagementIds.map(async (id) => {
          const object = await this.engagementService.readOne(
            id,
            event.session
          );
          const changes = await this.engagementRepo.getChangesetProps(
            id,
            updated.id
          );
          await this.db.updateProperties({
            type: LanguageEngagement,
            object,
            changes,
          });
        });
      }
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
