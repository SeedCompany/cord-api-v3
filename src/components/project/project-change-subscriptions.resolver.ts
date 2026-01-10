import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Hooks } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import {
  AnyProjectChange,
  AnyProjectChangeOrDeletion,
  IProject,
  ProjectCreated,
  ProjectDeleted,
  ProjectUpdated,
} from './dto';
import { ObserveProjectChangeHook } from './events';
import {
  ProjectChangedArgs,
  type ProjectChangedPayload,
  ProjectChannels,
} from './project.channels';
import { ProjectLoader } from './project.loader';

@Resolver(AnyProjectChange)
export class ProjectChangeSubscriptionsResolver {
  constructor(
    private readonly channels: ProjectChannels,
    private readonly loaders: ResourceLoader,
    private readonly hooks: Hooks,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProjectChangedPayload>(payload: Payload) => {
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
        ({ project, at, by }): ProjectCreated => ({
          __typename: 'ProjectCreated',
          projectId: project,
          at,
          by,
        }),
      ),
    );
  }

  @Subscription(() => ProjectUpdated)
  projectUpdated(@Args() args: ProjectChangedArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, changes, at, by }): ProjectUpdated => ({
          __typename: 'ProjectUpdated',
          projectId: project,
          changes,
          changedKeys: keys(changes),
          at,
          by,
        }),
      ),
    );
  }

  @Subscription(() => ProjectDeleted)
  projectDeleted(@Args() args: ProjectChangedArgs) {
    return this.channels.deleted(args).pipe(
      map(
        ({ project: id, at, by }): ProjectDeleted => ({
          __typename: 'ProjectDeleted',
          projectId: id,
          at,
          by,
        }),
      ),
    );
  }

  @Subscription(() => AnyProjectChangeOrDeletion, {
    description: 'Subscribe to any changes of project(s)',
  })
  async projectChanges(@Args() args: ProjectChangedArgs) {
    const channels = new Set<ObservableInput<AnyProjectChange>>([
      this.projectCreated(),
      this.projectUpdated(args),
      this.projectDeleted(args),
    ]);
    await this.hooks.run(new ObserveProjectChangeHook(args, channels));
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
