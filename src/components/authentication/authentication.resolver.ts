import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Response } from 'express';
import { DateTime } from 'luxon';
import { ISession, Session } from '../../common';
import { ConfigService } from '../../core';
import { UserService } from '../user';
import {
  CreateSessionOutput,
  LoginInput,
  LoginOutput,
  ResetPasswordInput,
} from './authentication.dto';
import { AuthenticationService } from './authentication.service';

@Resolver()
export class AuthenticationResolver {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userService: UserService,
    private readonly config: ConfigService
  ) {}

  @Mutation(() => CreateSessionOutput, {
    description: 'Create a session',
  })
  async createSession(
    @Args('browser') browser: boolean,
    @Context('response') res: Response
  ): Promise<CreateSessionOutput> {
    const token = await this.authService.createToken();

    if (browser) {
      // http cookies must have an expiration in order to persist, so we're setting it to 10 years in the future
      const expires = DateTime.local().plus({ years: 10 }).toJSDate();

      res.cookie(this.config.sessionCookieName, token, {
        expires,
        httpOnly: true,
        path: '/',
        domain: this.config.sessionCookieDomain,
      });
    }

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
