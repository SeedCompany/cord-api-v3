import { UnauthorizedException as UnauthenticatedException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { ISession, Session } from '../../common';
import { ConfigService, ILogger, Logger } from '../../core';
import { UserService } from '../user';
import {
  ForgotPasswordArgs,
  LoginInput,
  LoginOutput,
  ResetPasswordInput,
  SessionOutput,
} from './authentication.dto';
import { AuthenticationService } from './authentication.service';
import { SessionPipe } from './session.pipe';

@Resolver()
export class AuthenticationResolver {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userService: UserService,
    private readonly config: ConfigService,
    private readonly sessionPipe: SessionPipe,
    @Logger('authentication:resolver') private readonly logger: ILogger
  ) {}

  @Query(() => SessionOutput, {
    description: 'Create or retrieve an existing session',
  })
  async session(
    @Context('request') req: Request,
    @Context('response') res: Response,
    @Args({
      name: 'browser',
      description:
        'Set to true to enable http cookie sessions for use in a browser-based environment.',
      type: () => Boolean,
      defaultValue: false,
    })
    browser?: boolean
  ): Promise<SessionOutput> {
    const existingToken =
      this.sessionPipe.getTokenFromAuthHeader(req) ||
      this.sessionPipe.getTokenFromCookie(req);

    let token = existingToken || (await this.authService.createToken());
    let session;
    try {
      session = await this.authService.createSession(token);
    } catch (e) {
      if (!(e instanceof UnauthenticatedException)) {
        throw e;
      }
      this.logger.error(
        'Failed to use existing session token, creating new one.',
        { exception: e }
      );
      token = await this.authService.createToken();
      session = await this.authService.createSession(token);
    }

    const userFromSession = await this.authService.userFromSession(session);

    if (browser) {
      // http cookies must have an expiration in order to persist, so we're setting it to 10 years in the future
      const expires = DateTime.local().plus({ years: 10 }).toJSDate();

      res.cookie(this.config.session.cookieName, token, {
        expires,
        httpOnly: true,
        path: '/',
        domain: this.config.session.cookieDomain,
      });

      return { user: userFromSession };
    }

    return { token, user: userFromSession };
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
    const user = await this.userService.readOne(userId, loggedInSession);
    return { user };
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
  async forgotPassword(
    @Args() { email }: ForgotPasswordArgs
  ): Promise<boolean> {
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
