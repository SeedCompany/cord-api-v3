import {
  Args,
  Context,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, GqlContextType, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { Powers as Power, Privileges } from '../authorization';
import { User, UserLoader } from '../user';
import { AuthenticationService } from './authentication.service';
import { LoginInput, LoginOutput, LogoutOutput } from './dto';

@Resolver(LoginOutput)
export class LoginResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly privileges: Privileges,
  ) {}

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Args('input') input: LoginInput,
    @AnonSession() session: Session,
    @Context() context: GqlContextType,
  ): Promise<LoginOutput> {
    const user = await this.authentication.login(input, session);
    await this.authentication.updateSession(context);
    return { user };
  }

  @Mutation(() => LogoutOutput, {
    description: 'Logout a user',
  })
  async logout(
    @AnonSession() session: Session,
    @Context() context: GqlContextType,
  ): Promise<LogoutOutput> {
    await this.authentication.logout(session.token);
    await this.authentication.updateSession(context); // ensure session data is fresh
    return { success: true };
  }

  @ResolveField(() => User, { description: 'The logged-in user' })
  async user(
    @Parent() { user }: LoginOutput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user);
  }

  @ResolveField(() => [Power])
  async powers(@AnonSession() session: Session): Promise<Power[]> {
    return [...this.privileges.forUser(session).powers];
  }
}
