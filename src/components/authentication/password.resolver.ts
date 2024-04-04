import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, LoggedInSession, Session } from '~/common';
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
    @LoggedInSession() session: Session,
  ): Promise<ChangePasswordOutput> {
    await this.authentication.changePassword(oldPassword, newPassword, session);
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
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
    @AnonSession() session: Session,
  ): Promise<ResetPasswordOutput> {
    await this.authentication.resetPassword(input, session);
    return { success: true };
  }
}
