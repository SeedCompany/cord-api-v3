import { ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { ProjectRepository } from '../project.repository';
import { ProjectService } from '../project.service';

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
      const changes = await this.projectRepo.getChangesetProps(changesetId);
      if (!changes) {
        return; // if nothing changed, nothing to do
      }
      const { id, createdAt, type, ...actualChanges } = changes;
      await this.projectService.update(
        {
          id,
          ...actualChanges,
        },
        event.session,
        undefined,
        false
      );

      // TODO handle relations (locations, etc.)
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }
}
