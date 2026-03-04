import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { AuthenticationService } from '../authentication.service';
import { LoggedIn, LoggedOut, LoginInput } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';
import { SessionHost } from '../session/session.host';

@Resolver(LoggedIn)
@AuthLevel(AuthLevel.Anonymous)
export class LoginResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly sessionHost: SessionHost,
  ) {}

  @Mutation(() => LoggedIn, {
    description: stripIndent`
      Login a user
      @sensitive-secrets
    `,
  })
  async login(@Args('input') input: LoginInput): Promise<LoggedIn> {
    const user = await this.authentication.login(input);
    return { user };
  }

  @Mutation(() => LoggedOut, {
    description: stripIndent`
      Logout a user
      @sensitive-secrets
    `,
  })
  async logout(): Promise<LoggedOut> {
    const session = this.sessionHost.current;
    await this.authentication.logout(session.token);
    return {};
  }

  @ResolveField(() => User, { description: 'The logged-in user' })
  async user(
    @Parent() { user }: LoggedIn,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user);
  }
}
