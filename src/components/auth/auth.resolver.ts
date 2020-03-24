import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { UserService } from '../user';
import {
  CreateSessionOutput,
  LoginInput,
  LoginOutput,
  ResetPasswordInput,
} from './auth.dto';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Mutation(() => CreateSessionOutput, {
    description: 'Create a session',
  })
  async createSession(): Promise<CreateSessionOutput> {
    const token = await this.authService.createToken();
    return { token };
  }

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Session() session: ISession,
    @Args('input') input: LoginInput
  ): Promise<LoginOutput> {
    const userId = await this.authService.login(input, session);
    const loggedInSession = await this.authService.createSession(session.token);
    if (!userId) {
      return { success: false };
    }
    const user = await this.userService.readOne(userId, loggedInSession);
    return {
      success: true,
      user,
    };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(@Session() session: ISession): Promise<boolean> {
    await this.authService.logout(session.token);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Forgot password; send password reset email',
  })
  async forgotPassword(@Args('email') email: string): Promise<boolean> {
    await this.authService.forgotPassword(email);
    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Reset Password',
  })
  async resetPassword(
    @Args('input') input: ResetPasswordInput
  ): Promise<boolean> {
    await this.authService.resetPassword(input);
    return true;
  }
}
