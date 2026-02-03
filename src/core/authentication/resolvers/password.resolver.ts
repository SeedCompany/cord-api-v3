import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { stripIndent } from 'common-tags';
import { UserLoader } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { AuthenticationService } from '../authentication.service';
import {
  ChangePassword,
  PasswordResetRequested,
  PasswordUpdated,
  RequestPasswordReset,
  ResetPassword,
} from '../dto';
import { Identity } from '../identity.service';
import { AuthLevel } from '../session/auth-level.decorator';

@Resolver(PasswordUpdated)
export class PasswordResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly identity: Identity,
  ) {}

  @Mutation(() => PasswordUpdated, {
    description: stripIndent`
      Change your password
      @sensitive-secrets
    `,
  })
  async changePassword(
    @Args() input: ChangePassword,
  ): Promise<PasswordUpdated> {
    await this.authentication.changePassword(input);
    const user = this.identity.current.userId;
    return { user: { id: user } };
  }

  @Mutation(() => PasswordResetRequested, {
    description: 'Forgot password; send password reset email',
  })
  @AuthLevel(AuthLevel.Anonymous)
  async forgotPassword(
    @Args() input: RequestPasswordReset,
  ): Promise<PasswordResetRequested> {
    await this.authentication.forgotPassword(input);
    return { email: input.email };
  }

  @Mutation(() => PasswordUpdated, {
    description: stripIndent`
      Reset Password
      @sensitive-secrets
    `,
  })
  @AuthLevel(AuthLevel.Anonymous)
  async resetPassword(@Args() input: ResetPassword): Promise<PasswordUpdated> {
    const { user } = await this.authentication.resetPassword(input);
    return { user };
  }

  @ResolveField(() => User)
  async user(
    @Parent() { user }: PasswordUpdated,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user.id);
  }
}
