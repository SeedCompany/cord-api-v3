import { EventsHandler, IEventHandler, ILogger, Logger } from '~/core';
import { DatabaseService } from '~/core/database';
import { resolveProjectType } from '../dto';
import { ProjectUpdatedEvent } from '../events';

@EventsHandler(ProjectUpdatedEvent)
export class ProjectStepChangedAtHandler
  implements IEventHandler<ProjectUpdatedEvent>
{
  constructor(
    private readonly db: DatabaseService,
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
