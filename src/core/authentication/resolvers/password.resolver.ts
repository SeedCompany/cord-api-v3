import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AuthenticationService } from '../authentication.service';
import {
  ChangePasswordArgs,
  ForgotPasswordArgs,
  ForgotPasswordSent,
  PasswordChanged,
  PasswordReset,
  ResetPassword,
} from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';

@Resolver()
export class PasswordResolver {
  constructor(private readonly authentication: AuthenticationService) {}

  @Mutation(() => PasswordChanged, {
    description: stripIndent`
      Change your password
      @sensitive-secrets
    `,
  })
  async changePassword(
    @Args() { oldPassword, newPassword }: ChangePasswordArgs,
  ): Promise<PasswordChanged> {
    await this.authentication.changePassword(oldPassword, newPassword);
    return { success: true };
  }

  @Mutation(() => ForgotPasswordSent, {
    description: 'Forgot password; send password reset email',
  })
  @AuthLevel('anonymous')
  async forgotPassword(
    @Args() { email }: ForgotPasswordArgs,
  ): Promise<ForgotPasswordSent> {
    await this.authentication.forgotPassword(email);
    return { success: true };
  }

  @Mutation(() => PasswordReset, {
    description: stripIndent`
      Reset Password
      @sensitive-secrets
    `,
  })
  @AuthLevel('anonymous')
  async resetPassword(
    @Args('input') input: ResetPassword,
  ): Promise<PasswordReset> {
    await this.authentication.resetPassword(input);
    return { success: true };
  }
}
