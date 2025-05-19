import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Loader, type LoaderOf } from '~/core';
import { Privileges } from '../authorization';
import { Power } from '../authorization/dto';
import { UserLoader } from '../user';
import { User } from '../user/dto';
import { Anonymous } from './anonymous.decorator';
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
  @Anonymous()
  async register(@Args('input') input: RegisterInput): Promise<RegisterOutput> {
    const user = await this.authentication.register(input);
    await this.authentication.login(input);
    await this.authentication.refreshCurrentSession();
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
  async powers(): Promise<Power[]> {
    return [...this.privileges.powers];
  }
}
