import { forwardRef, Inject } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Request } from 'express';
import { AnonSession, Session } from '../../common';
import { loggedInSession } from '../../common/session';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { AuthenticationService } from './authentication.service';
import { LoginInput, LoginOutput } from './dto';

@Resolver()
export class LoginResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService,
    private readonly users: UserService
  ) {}

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Args('input') input: LoginInput,
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<LoginOutput> {
    const userId = await this.authentication.login(input, session);
    const newSession = loggedInSession(
      await this.authentication.updateSession(req)
    );
    const user = await this.users.readOne(userId, newSession);
    const powers = await this.authorization.readPower(newSession);
    return { user, powers };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<boolean> {
    await this.authentication.logout(session.token);
    await this.authentication.updateSession(req); // ensure session data is fresh
    return true;
  }
}
