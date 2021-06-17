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
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { ProjectRepository } from '../../project/project.repository';
import { ProjectService } from '../../project/project.service';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
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

      // Get unsecured project with changeset
      if (result?.projectId) {
        const project = await this.projectService.readOne(
          result.projectId,
          event.session
        );
        const changes = await this.projectRepo.getChangesetProps(
          result.projectId,
          changesetId
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
