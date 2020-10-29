import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ProjectUpdatedEvent } from '../events';
import { ProjectService } from '../project.service';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectStepChangedAtHandler
  implements IEventHandler<ProjectUpdatedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    @Logger('project:step-changed-at') private readonly logger: ILogger
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    if (event.updated.step.value === event.previous.step.value) {
      return;
    }

    try {
      const project = event.updated;
      const changes = {
        id: project.id,
        stepChangedAt: project.modifiedAt,
      };

      event.updated = await this.db.sgUpdateProperties({
        object: project,
        session: event.session,
        props: ['stepChangedAt'],
        changes,
        nodevar: 'Project',
      });
    } catch (e) {
      this.logger.error(`Could not update step changed at on project`, {
        userId: event.session.userId,
        exception: e,
      });
      throw e;
    }
  }
}
