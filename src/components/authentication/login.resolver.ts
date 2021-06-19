import { forwardRef, Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Field,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Request } from 'express';
import { AnonSession, Session } from '../../common';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto';
import { User, UserService } from '../user';
import { AuthenticationService } from './authentication.service';
import { LoginInput, LoginOutput, RegisterOutput } from './dto';

@Resolver(LoginOutput)
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
    const user = await this.authentication.login(input, session);
    await this.authentication.updateSession(req);
    return { user };
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

  @ResolveField(() => User, { description: 'The logged-in user' })
  async user(
    @Parent() { user }: RegisterOutput,
    @AnonSession() session: Session
  ): Promise<User> {
    return await this.users.readOne(user, session);
  }

  @Field(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorization.readPower(session);
  }
}
