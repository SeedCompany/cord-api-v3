import {
  Args,
  Context,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, GqlContextType, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Privileges } from '../authorization';
import { Power } from '../authorization/dto';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { AuthenticationService } from './authentication.service';
import { RegisterInput, RegisterOutput } from './dto';

@Resolver(RegisterOutput)
export class RegisterResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly privileges: Privileges,
  ) {}

  @Mutation(() => RegisterOutput, {
    description: stripIndent`
      Register a new user
      @sensitive-secrets
    `,
  })
  async register(
    @Args('input') input: RegisterInput,
    @AnonSession() session: Session,
    @Context() context: GqlContextType,
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
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user);
  }

  @ResolveField(() => [Power])
  async powers(@AnonSession() session: Session): Promise<Power[]> {
    return [...this.privileges.forUser(session).powers];
  }
}
