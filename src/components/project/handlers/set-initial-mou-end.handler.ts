import { ServerException } from '~/common';
import { EventsHandler, type IEventHandler } from '~/core';
import { DatabaseService } from '~/core/database';
import { IProject, ProjectStatus } from '../dto';
import { ProjectCreatedEvent } from '../events';
import { ProjectTransitionedEvent } from '../workflow/events/project-transitioned.event';

type SubscribedEvent = ProjectCreatedEvent | ProjectTransitionedEvent;

@EventsHandler(ProjectCreatedEvent, ProjectTransitionedEvent)
export class SetInitialMouEnd implements IEventHandler<SubscribedEvent> {
  constructor(private readonly db: DatabaseService) {}

  async handle(event: SubscribedEvent) {
    const { project } = event;

    if (
      event instanceof ProjectTransitionedEvent && // allow setting initial if creating with non-in-dev status
      project.status !== ProjectStatus.InDevelopment
    ) {
      return;
    }
    if (project.initialMouEnd?.toMillis() === project.mouEnd?.toMillis()) {
      return;
    }

    try {
      const updatedProject = await this.db.updateProperties({
        type: IProject,
        object: project,
        changes: {
          initialMouEnd: project.mouEnd || null,
        },
      });

      if (event instanceof ProjectTransitionedEvent) {
        event.project = updatedProject;
      } else {
        event.project = updatedProject;
      }
    } catch (exception) {
      throw new ServerException('Could not set initial mou end on project', exception);
    }
  }
}
