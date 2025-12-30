import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { type ID, IdArg, Subscription } from '~/common';
import { omitNotFound$ } from '~/common';
import { ResourceLoader } from '~/core/resources';
import {
  AnyProjectChange,
  AnyProjectChangeOrDeletion,
  IProject,
  ProjectCreated,
  ProjectDeleted,
  ProjectUpdated,
} from './dto';
import { ProjectChannels } from './project.channels';
import { ProjectLoader } from './project.loader';

@Resolver(AnyProjectChange)
export class ProjectChangeSubscriptionsResolver {
  constructor(
    private readonly channels: ProjectChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  private verifyReadPermission$() {
    return mergeMap((id: ID<'Project'>) => {
      // Omit event if the user watching doesn't have permission to view the project
      return from(this.loaders.load('Project', id)).pipe(omitNotFound$());
    });
  }

  @Subscription(() => ProjectCreated)
  projectCreated() {
    return this.channels.created().pipe(
      this.verifyReadPermission$(),
      map(
        (project): ProjectCreated => ({
          __typename: 'ProjectCreated',
          projectId: project.id,
        }),
      ),
    );
  }

  @Subscription(() => ProjectUpdated)
  projectUpdated(@IdArg({ nullable: true }) id?: ID) {
    return this.channels.updated(id).pipe(
      this.verifyReadPermission$(),
      map(
        (project): ProjectUpdated => ({
          __typename: 'ProjectUpdated',
          projectId: project.id,
        }),
      ),
    );
  }

  @Subscription(() => ProjectDeleted)
  projectDeleted(@IdArg({ nullable: true }) id?: ID) {
    return this.channels.deleted(id).pipe(
      map(
        (id): ProjectDeleted => ({
          __typename: 'ProjectDeleted',
          projectId: id,
        }),
      ),
    );
  }

  @Subscription(() => AnyProjectChangeOrDeletion, {
    description: 'Subscribe to any changes of project(s)',
  })
  async projectChanges(
    @IdArg({ nullable: true }) id: ID<'Project'> | undefined,
  ) {
    const channels = new Set<ObservableInput<AnyProjectChange>>([
      this.projectCreated(),
      this.projectUpdated(id),
      this.projectDeleted(id),
    ]);
    return merge(...channels);
  }

  @ResolveField(() => IProject)
  async project(
    @Parent() change: AnyProjectChange,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<IProject> {
    return await projects.load({
      id: change.projectId,
      view: { active: true } as const,
    });
  }
}
