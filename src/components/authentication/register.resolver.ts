import { forwardRef, Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Request } from 'express';
import { AnonSession, Session } from '../../common';
import { DataLoader, Loader } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto';
import { User } from '../user';
import { AuthenticationService } from './authentication.service';
import { RegisterInput, RegisterOutput } from './dto';

@Resolver(RegisterOutput)
export class RegisterResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService
  ) {}

  @Mutation(() => RegisterOutput, {
    description: 'Register a new user',
  })
  async register(
    @Args('input') input: RegisterInput,
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<RegisterOutput> {
    const user = await this.authentication.register(input, session);
    await this.authentication.login(input, session);
    await this.authentication.updateSession(req);
    return { user };
  }

  @ResolveField(() => User, {
    description: 'The newly created, logged-in user',
  })
  async user(
    @Parent() { user }: RegisterOutput,
    @Loader(User) users: DataLoader<User>
  ): Promise<User> {
    return await users.load(user);
  }

  @ResolveField(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorization.readPower(session);
  }
}
