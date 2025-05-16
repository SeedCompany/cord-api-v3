import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Anonymous } from './anonymous.decorator';
import { AuthenticationService } from './authentication.service';
import {
  ChangePasswordArgs,
  ChangePasswordOutput,
  ForgotPasswordArgs,
  ForgotPasswordOutput,
  ResetPasswordInput,
  ResetPasswordOutput,
} from './dto';

@Resolver()
export class PasswordResolver {
  constructor(private readonly authentication: AuthenticationService) {}

  @Mutation(() => ChangePasswordOutput, {
    description: stripIndent`
      Change your password
      @sensitive-secrets
    `,
  })
  async changePassword(
    @Args() { oldPassword, newPassword }: ChangePasswordArgs,
  ): Promise<ChangePasswordOutput> {
    await this.authentication.changePassword(oldPassword, newPassword);
    return { success: true };
  }

  @Mutation(() => ForgotPasswordOutput, {
    description: 'Forgot password; send password reset email',
  })
  async forgotPassword(
    @Args() { email }: ForgotPasswordArgs,
  ): Promise<ForgotPasswordOutput> {
    await this.authentication.forgotPassword(email);
    return { success: true };
  }

  @Mutation(() => ResetPasswordOutput, {
    description: stripIndent`
      Reset Password
      @sensitive-secrets
    `,
  })
  @Anonymous()
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<ResetPasswordOutput> {
    await this.authentication.resetPassword(input);
    return { success: true };
  }
}
