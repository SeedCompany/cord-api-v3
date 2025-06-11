import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Loader, type LoaderOf } from '~/core';
import { UserLoader } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { AuthenticationService } from '../authentication.service';
import { LoginInput, LoginOutput, LogoutOutput } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';
import { SessionHost } from '../session/session.host';

@Resolver(LoginOutput)
@AuthLevel('anonymous')
export class LoginResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly sessionHost: SessionHost,
  ) {}

  @Mutation(() => LoginOutput, {
    description: stripIndent`
      Login a user
      @sensitive-secrets
    `,
  })
  async login(@Args('input') input: LoginInput): Promise<LoginOutput> {
    const user = await this.authentication.login(input);
    return { user };
  }

  @Mutation(() => LogoutOutput, {
    description: stripIndent`
      Logout a user
      @sensitive-secrets
    `,
  })
  async logout(): Promise<LogoutOutput> {
    const session = this.sessionHost.current;
    await this.authentication.logout(session.token);
    return { success: true };
  }

  @ResolveField(() => User, { description: 'The logged-in user' })
  async user(
    @Parent() { user }: LoginOutput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user);
  }
}
