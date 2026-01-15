import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { UnauthorizedException } from '~/common';
import { ConfigService } from '~/core/config';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { AuthenticationService } from '../authentication.service';
import { RegisterOutput, RegisterUser } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';

@Resolver(RegisterOutput)
@AuthLevel('anonymous')
export class RegisterResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly config: ConfigService,
  ) {}

  @Mutation(() => RegisterOutput, {
    description: stripIndent`
      Register a new user
      @sensitive-secrets
    `,
  })
  async register(@Args('input') input: RegisterUser): Promise<RegisterOutput> {
    if (!this.config.registrationEnabled) {
      throw new UnauthorizedException(
        'User registration is currently disabled',
      );
    }

    const user = await this.authentication.register(input);
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
}
