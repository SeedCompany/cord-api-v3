import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { ISession, Session } from '../../common';
import { ConfigService, ILogger, Logger } from '../../core';
import { UserService } from '../user';
import {
  ChangePasswordArgs,
  ForgotPasswordArgs,
  LoginInput,
  LoginOutput,
  ResetPasswordInput,
  SessionOutput,
} from './authentication.dto';
import { AuthenticationService } from './authentication.service';
import { RegisterInput, RegisterOutput } from './dto';
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
    } catch (exception) {
      // if (!(e instanceof UnauthenticatedException)) {
      //   throw e;
      // }
      this.logger.debug(
        'Failed to use existing session token, creating new one.',
        { exception }
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
    @Args('input') input: LoginInput,
    @Session() session: ISession,
    @Context('request') req: Request
  ): Promise<LoginOutput> {
    const userId = await this.authService.login(input, session);
    const loggedInSession = await this.updateSession(req);
    const user = await this.userService.readOne(userId, loggedInSession);
    return { user };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(
    @Session() session: ISession,
    @Context('request') req: Request
  ): Promise<boolean> {
    await this.authService.logout(session.token);
    await this.updateSession(req); // ensure session data is fresh
    return true;
  }

  @Mutation(() => RegisterOutput, {
    description: 'Register a new user',
  })
  async register(
    @Args('input') input: RegisterInput,
    @Session() session: ISession,
    @Context('request') req: Request
  ): Promise<RegisterOutput> {
    const userId = await this.authService.register(input, session);
    await this.authService.login(input, session);
    const loggedInSession = await this.updateSession(req);
    const user = await this.userService.readOne(userId, loggedInSession);
    return { user };
  }

  private async updateSession(req: Request) {
    const newSession = await this.authService.createSession(req.session!.token);
    req.session = newSession; // replace session given with session pipe
    return newSession;
  }

  @Mutation(() => Boolean, {
    description: 'Change your password',
  })
  async changePassword(
    @Args() { oldPassword, newPassword }: ChangePasswordArgs,
    @Session() session: ISession
  ): Promise<boolean> {
    await this.authService.changePassword(oldPassword, newPassword, session);
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
