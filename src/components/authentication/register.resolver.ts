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
    @Context() context: GqlContextType
  ): Promise<RegisterOutput> {
    const user = await this.authentication.register(input, session);
    await this.authentication.login(input, session);
    await this.authentication.updateSession(context);
    return { user };
  }

  @ResolveField(() => User, {
    description: 'The newly created, logged-in user',
  })
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
