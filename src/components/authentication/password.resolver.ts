import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AnonSession, LoggedInSession, Session } from '../../common';
import { AuthenticationService } from './authentication.service';
import {
  ChangePasswordArgs,
  ForgotPasswordArgs,
  ResetPasswordInput,
} from './dto';

@Resolver()
export class PasswordResolver {
  constructor(private readonly authentication: AuthenticationService) {}

  @Mutation(() => Boolean, {
    description: 'Change your password',
  })
  async changePassword(
    @Args() { oldPassword, newPassword }: ChangePasswordArgs,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.authentication.changePassword(oldPassword, newPassword, session);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Forgot password; send password reset email',
  })
  async forgotPassword(
    @Args() { email }: ForgotPasswordArgs
  ): Promise<boolean> {
    await this.authentication.forgotPassword(email);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Reset Password',
  })
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
    @AnonSession() session: Session
  ): Promise<boolean> {
    await this.authentication.resetPassword(input, session);
    return true;
  }
}
