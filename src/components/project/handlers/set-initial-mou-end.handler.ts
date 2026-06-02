import { eq } from 'drizzle-orm';
import { ServerException } from '~/common';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { projects } from '~/core/drizzle/schema';
import { OnHook } from '~/core/hooks';
import { DatabaseService } from '~/core/neo4j';
import { IProject, ProjectStatus } from '../dto';
import { ProjectCreatedHook } from '../hooks';
import { ProjectTransitionedHook } from '../workflow/hooks/project-transitioned.hook';

type SubscribedEvent = ProjectCreatedHook | ProjectTransitionedHook;

@OnHook(ProjectCreatedHook)
@OnHook(ProjectTransitionedHook)
export class SetInitialMouEnd {
  constructor(
    private readonly db: DatabaseService,
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
  ) {}

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
      // migration-todo: collapse this engine-check at Phase 7 cutover — drop
      // the Neo4j branch + DatabaseService injection, keep only the PG path.
      if (this.config.databaseEngine === 'postgres') {
        await this.drizzle.client
          .update(projects)
          .set({
            initialMouEnd: project.mouEnd ? project.mouEnd.toSQLDate() : null,
          })
          .where(eq(projects.id, project.id));
        // Mutate the hook payload so downstream handlers see the new value.
        event.project = { ...project, initialMouEnd: project.mouEnd ?? null };
        return;
      }

      const updatedProject = await this.db.updateProperties({
        type: IProject,
        object: project,
        changes: {
          initialMouEnd: project.mouEnd || null,
        },
      });
      event.project = updatedProject;
    } catch (exception) {
      throw new ServerException(
        'Could not set initial mou end on project',
        exception,
      );
    }
  }
}
