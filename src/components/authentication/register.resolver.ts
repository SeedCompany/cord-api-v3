import { forwardRef, Inject } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Request } from 'express';
import { AnonSession, Session } from '../../common';
import { loggedInSession } from '../../common/session';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { AuthenticationService } from './authentication.service';
import { RegisterInput, RegisterOutput } from './dto';

@Resolver()
export class RegisterResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService,
    private readonly users: UserService
  ) {}

  @Mutation(() => RegisterOutput, {
    description: 'Register a new user',
  })
  async register(
    @Args('input') input: RegisterInput,
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<RegisterOutput> {
    const userId = await this.authentication.register(input, session);
    await this.authentication.login(input, session);
    const newSession = loggedInSession(
      await this.authentication.updateSession(req)
    );
    const user = await this.users.readOne(userId, newSession);
    const powers = await this.authorization.readPower(newSession);
    return { user, powers };
  }
}
