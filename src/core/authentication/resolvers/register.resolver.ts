import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Loader, type LoaderOf } from '~/core';
import { UserLoader } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { AuthenticationService } from '../authentication.service';
import { RegisterInput, RegisterOutput } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';

@Resolver(RegisterOutput)
@AuthLevel('anonymous')
export class RegisterResolver {
  constructor(private readonly authentication: AuthenticationService) {}

  @Mutation(() => RegisterOutput, {
    description: stripIndent`
      Register a new user
      @sensitive-secrets
    `,
  })
  async register(@Args('input') input: RegisterInput): Promise<RegisterOutput> {
    const user = await this.authentication.register(input);
    return { user };
  }

  @ResolveField(() => User, {
    description: 'The newly created, logged-in user',
  })
  async user(
    @Parent() { user }: RegisterOutput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user);
  }
}
