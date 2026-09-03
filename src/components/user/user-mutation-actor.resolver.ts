import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { NotFoundException } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ActorLoader } from './actor.loader';
import { SecuredActor, UserMutationOrDeletion } from './dto';

@Resolver(UserMutationOrDeletion)
export class UserMutationActorResolver {
  @ResolveField(() => SecuredActor, {
    description: 'The actor who initiated the change',
  })
  async by(
    @Parent() mutation: UserMutationOrDeletion,
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
