import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { NotFoundException } from '~/common';
import { ActorLoader } from '../../user/actor.loader';
import { SecuredActor } from '../../user/dto';
import { ProjectMemberMutation, ProjectMemberMutationOrDeletion } from './dto';

@Resolver(ProjectMemberMutationOrDeletion)
export class ProjectMemberMutationActorResolver {
  @ResolveField(() => SecuredActor, {
    description: 'The actor who initiated the change',
  })
  async by(
    @Parent() mutation: ProjectMemberMutation,
    @Loader(ActorLoader) actors: LoaderOf<ActorLoader>,
  ): Promise<SecuredActor> {
    const actor = await actors.load(mutation.by).catch((e) => {
      if (e instanceof NotFoundException) {
        return undefined;
      }
      throw e;
    });
    return {
      canRead: !!actor,
      canEdit: false,
      value: actor,
    };
  }
}
