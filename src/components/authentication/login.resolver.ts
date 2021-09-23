import { forwardRef, Inject } from '@nestjs/common';
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
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto';
import { User, UserLoader } from '../user';
import { AuthenticationService } from './authentication.service';
import { LoginInput, LoginOutput, RegisterOutput } from './dto';

@Resolver(LoginOutput)
export class LoginResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService
  ) {}

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Args('input') input: LoginInput,
    @AnonSession() session: Session,
    @Context() context: GqlContextType
  ): Promise<LoginOutput> {
    const user = await this.authentication.login(input, session);
    await this.authentication.updateSession(context);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(
    @AnonSession() session: Session,
    @Context() context: GqlContextType
  ): Promise<boolean> {
    await this.authentication.logout(session.token);
    await this.authentication.updateSession(context); // ensure session data is fresh
    return true;
  }

  @ResolveField(() => User, { description: 'The logged-in user' })
  async user(
    @Parent() { user }: RegisterOutput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<User> {
    return await users.load(user);
  }

  @ResolveField(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorization.readPower(session);
  }
}
