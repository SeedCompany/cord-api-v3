import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { UpdateProject } from '../../project';
import { ProjectChangeRequestStatus } from '../../project-change-request/dto';
import { ProjectChangeRequestUpdatedEvent } from '../../project-change-request/events';
import { ProjectRepository } from '../../project/project.repository';
import { ProjectService } from '../../project/project.service';

type SubscribedEvent = ProjectChangeRequestUpdatedEvent;

@EventsHandler(ProjectChangeRequestUpdatedEvent)
export class ApplyApprovedChangesetToProject
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    private readonly projectRepo: ProjectRepository,
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
      }
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
