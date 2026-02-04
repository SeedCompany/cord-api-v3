import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { from, map, merge, mergeMap, type ObservableInput } from 'rxjs';
import { omitNotFound$, Subscription } from '~/common';
import { Hooks } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import {
  ProjectMemberCreated,
  ProjectMemberDeleted,
  ProjectMemberMutation,
  ProjectMemberMutationOrDeletion,
  ProjectMemberUpdated,
  ProjectMember,
} from './dto';
import { ObserveProjectMemberMutationHook } from './events';
import {
  ProjectMemberChannels,
  ProjectMemberMutationArgs,
  type ProjectMemberMutationPayload,
} from './project-member.channels';
import { ProjectMemberLoader } from './project-member.loader';

@Resolver(ProjectMemberMutation)
export class ProjectMemberMutationSubscriptionsResolver {
  constructor(
    private readonly channels: ProjectMemberChannels,
    private readonly loaders: ResourceLoader,
    private readonly hooks: Hooks,
  ) {}

  private verifyReadPermission$() {
    return mergeMap(
      <Payload extends ProjectMemberMutationPayload>(payload: Payload) => {
        // Omit event if the user watching doesn't have permission to view the project member
        return from(
          this.loaders.load('ProjectMember', payload.projectMember),
        ).pipe(
          omitNotFound$(),
          map(() => payload),
        );
      },
    );
  }

  @Subscription(() => ProjectMemberCreated)
  projectMemberCreated() {
    return this.channels.created().pipe(
      this.verifyReadPermission$(),
      map(
        ({ projectMember, ...rest }): ProjectMemberCreated => ({
          __typename: 'ProjectMemberCreated',
          projectMemberId: projectMember,
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
        ({ projectMember, ...rest }): ProjectMemberUpdated => ({
          __typename: 'ProjectMemberUpdated',
          projectMemberId: projectMember,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMemberDeleted)
  projectMemberDeleted(@Args() args: ProjectMemberMutationArgs) {
    return this.channels.deleted(args).pipe(
      map(
        ({ projectMember: id, ...rest }): ProjectMemberDeleted => ({
          __typename: 'ProjectMemberDeleted',
          projectMemberId: id,
          ...rest,
        }),
      ),
    );
  }

  @Subscription(() => ProjectMemberMutationOrDeletion, {
    description: 'Subscribe to any mutations of project member(s)',
  })
  async projectMemberMutations(@Args() args: ProjectMemberMutationArgs) {
    const channels = new Set<
      ObservableInput<ProjectMemberMutationOrDeletion>
    >([
      this.projectMemberCreated(),
      this.projectMemberUpdated(args),
      this.projectMemberDeleted(args),
    ]);
    await this.hooks.run(
      new ObserveProjectMemberMutationHook(args, channels),
    );
    return merge(...channels);
  }

  @ResolveField(() => ProjectMember)
  async projectMember(
    @Parent() change: ProjectMemberMutation,
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>,
  ): Promise<ProjectMember> {
    return await projectMembers.load(change.projectMemberId);
  }
}
