import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Hooks } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import {
  IProject,
  ProjectCreated,
  ProjectDeleted,
  ProjectMutation,
  ProjectMutationOrDeletion,
  ProjectUpdated,
} from './dto';
import { ObserveProjectMutationHook } from './events';
import {
  ProjectChannels,
  ProjectMutationArgs,
  type ProjectMutationPayload,
} from './project.channels';
import { ProjectLoader } from './project.loader';

@Resolver(ProjectMutation)
export class ProjectMutationSubscriptionsResolver {
  constructor(
    private readonly channels: ProjectChannels,
    private readonly loaders: ResourceLoader,
    private readonly hooks: Hooks,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProjectMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the project
        return from(this.loaders.load('Project', payload.project)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => ProjectCreated)
  projectCreated() {
    return this.channels.created().pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, ...rest }): ProjectCreated => ({
          __typename: 'ProjectCreated',
          projectId: project,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectUpdated)
  projectUpdated(@Args() args: ProjectMutationArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, ...rest }): ProjectUpdated => ({
          __typename: 'ProjectUpdated',
          projectId: project,
          ...rest,
          updatedKeys: keys(rest.updated),
        }),
      ),
    );
  }

  @Subscription(() => ProjectDeleted)
  projectDeleted(@Args() args: ProjectMutationArgs) {
    return this.channels.deleted(args).pipe(
      map(
        ({ project: id, ...rest }): ProjectDeleted => ({
          __typename: 'ProjectDeleted',
          projectId: id,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMutationOrDeletion, {
    description: 'Subscribe to any mutations of project(s)',
  })
  async projectMutations(@Args() args: ProjectMutationArgs) {
    const channels = new Set<ObservableInput<ProjectMutationOrDeletion>>([
      this.projectCreated(),
      this.projectUpdated(args),
      this.projectDeleted(args),
    ]);
    await this.hooks.run(new ObserveProjectMutationHook(args, channels));
    return merge(...channels);
  }

  @ResolveField(() => IProject)
  async project(
    @Parent() change: ProjectMutation,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<IProject> {
    return await projects.load({
      id: change.projectId,
      view: { active: true } as const,
    });
  }
}
