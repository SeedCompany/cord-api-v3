import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { resolveProjectType } from '../dto';
import { ProjectUpdatedEvent } from '../events';
import { ProjectService } from '../project.service';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectStepChangedAtHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    @Logger('project:step-changed-at') private readonly logger: ILogger,
  ) {}

  async handle(event: ProjectUpdatedEvent) {
    if (event.updated.step === event.previous.step) {
      return;
    }

    try {
      const project = event.updated;
      event.updated = await this.db.updateProperties({
        type: resolveProjectType(project),
        object: project,
        changes: {
          stepChangedAt: project.modifiedAt,
        },
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
