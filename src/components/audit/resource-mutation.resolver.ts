import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
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

  @ResolveField(() => User, {
    nullable: true,
    description: stripIndent`
      The real, requesting user behind an impersonated mutation — null when the
      actor was acting as themselves.

      When set, \`actor\` is who the mutation was performed AS and this is who
      performed it. Note this equals \`actor\` for role-only impersonation
      (\`X-CORD-Impersonate-Role\`), which records that a user acted under roles
      other than their own.
    `,
  })
  async impersonator(
    @Parent() mutation: ResourceMutation,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User | null> {
    if (!mutation.impersonator) {
      return null;
    }
    return await users.load(mutation.impersonator.id);
  }
}
