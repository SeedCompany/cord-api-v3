import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { ResourceMutation } from './dto/resource-mutation.dto';

@Resolver(ResourceMutation)
export class ResourceMutationResolver {
  @ResolveField(() => User, {
    nullable: true,
    description: 'The user who performed the mutation (null if system)',
  })
  async actor(
    @Parent() mutation: ResourceMutation,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User | null> {
    if (!mutation.actor) {
      return null;
    }
    return await users.load(mutation.actor.id);
  }
}
