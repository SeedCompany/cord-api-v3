import { ServerException } from '~/common';
import { OnHook } from '~/core';
import { DatabaseService } from '~/core/database';
import { IProject, ProjectStatus } from '../dto';
import { ProjectCreatedHook } from '../hooks';
import { ProjectTransitionedHook } from '../workflow/hooks/project-transitioned.hook';

type SubscribedEvent = ProjectCreatedHook | ProjectTransitionedHook;

@OnHook(ProjectCreatedHook)
@OnHook(ProjectTransitionedHook)
export class SetInitialMouEnd {
  constructor(private readonly db: DatabaseService) {}

  async handle(event: SubscribedEvent) {
    const { project } = event;

    if (
      event instanceof ProjectTransitionedHook && // allow setting initial if creating with non-in-dev status
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

      if (event instanceof ProjectTransitionedHook) {
        event.project = updatedProject;
      } else {
        event.project = updatedProject;
      }
    } catch (exception) {
      throw new ServerException(
        'Could not set initial mou end on project',
        exception,
      );
    }
  }
}
