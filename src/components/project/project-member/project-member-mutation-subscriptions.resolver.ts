import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { OnHook } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ObserveProjectMutationHook } from '../events';
import {
  ProjectMember,
  ProjectMemberCreated,
  ProjectMemberDeleted,
  ProjectMemberMutation,
  ProjectMemberMutationOrDeletion,
  ProjectMemberUpdated,
} from './dto';
import {
  ProjectMemberChannels,
  ProjectMemberCreatedArgs,
  ProjectMemberMutationArgs,
  type ProjectMemberMutationPayload,
} from './project-member.channels';
import { ProjectMemberLoader } from './project-member.loader';

@Resolver(ProjectMemberMutation)
export class ProjectMemberMutationSubscriptionsResolver {
  constructor(
    private readonly channels: ProjectMemberChannels,
    private readonly loaders: ResourceLoader,
  ) {}

  @OnHook(ObserveProjectMutationHook)
  observeProjectChanges(hook: ObserveProjectMutationHook) {
    hook.add(this.projectMemberMutations(hook.args));
  }

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProjectMemberMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the project member
        return from(this.loaders.load('Project', payload.project)).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => ProjectMemberCreated)
  projectMemberCreated(@Args() args: ProjectMemberCreatedArgs) {
    return this.channels.created(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, member, ...rest }): ProjectMemberCreated => ({
          __typename: 'ProjectMemberCreated',
          projectId: project,
          memberId: member,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMemberUpdated)
  projectMemberUpdated(@Args() args: ProjectMemberMutationArgs) {
    return this.channels.updated(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, member, ...rest }): ProjectMemberUpdated => ({
          __typename: 'ProjectMemberUpdated',
          projectId: project,
          memberId: member,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMemberDeleted)
  projectMemberDeleted(@Args() args: ProjectMemberMutationArgs) {
    return this.channels.deleted(args).pipe(
      this.verifyReadPermission$(),
      map(
        ({ project, member, ...rest }): ProjectMemberDeleted => ({
          __typename: 'ProjectMemberDeleted',
          projectId: project,
          memberId: member,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMemberMutationOrDeletion, {
    description: 'Subscribe to any mutations of project member(s)',
  })
  projectMemberMutations(@Args() args: ProjectMemberMutationArgs) {
    const channels = new Set<ObservableInput<ProjectMemberMutationOrDeletion>>([
      this.projectMemberCreated(args),
      this.projectMemberUpdated(args),
      this.projectMemberDeleted(args),
    ]);
    // No need as there's no "children" of these members, right now.
    // await this.hooks.run(new ObserveProjectMemberMutationHook(args, channels));
    return merge(...channels);
  }

  @ResolveField(() => ProjectMember)
  async projectMember(
    @Parent() change: ProjectMemberMutation,
    @Loader(ProjectMemberLoader) members: LoaderOf<ProjectMemberLoader>,
  ): Promise<ProjectMember> {
    return await members.load(change.memberId);
  }
}
