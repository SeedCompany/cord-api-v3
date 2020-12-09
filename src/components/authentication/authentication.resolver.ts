import { forwardRef, Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import {
  AnonSession,
  DuplicateException,
  LoggedInSession,
  Session,
  UnauthenticatedException,
} from '../../common';
import { anonymousSession, loggedInSession } from '../../common/session';
import { ConfigService, ILogger, Logger } from '../../core';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { ErrorCode } from '../../core/database/v4/dto/ErrorCode.enum';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { ApiUserOut } from '../user/dbv4';
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
import { RegisterOut } from './RegisterOut.db.dto';
import { SessionPipe } from './session.pipe';

@Resolver()
export class AuthenticationResolver {
  constructor(
    private readonly dbv4: DbV4,
    private readonly authService: AuthenticationService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
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
    let rawSession;
    try {
      rawSession = await this.authService.createSession(token);
    } catch (exception) {
      if (!(exception instanceof UnauthenticatedException)) {
        throw exception;
      }
      this.logger.debug(
        'Failed to use existing session token, creating new one.',
        { exception }
      );
      token = await this.authService.createToken();
      rawSession = await this.authService.createSession(token);
    }
    const session = anonymousSession(rawSession);

    const userFromSession = session.anonymous
      ? null
      : await this.authService.userFromSession(session);
    const powers = await this.authorizationService.readPower(session);

    if (browser) {
      // http cookies must have an expiration in order to persist, so we're setting it to 10 years in the future
      const expires = DateTime.local().plus({ years: 10 }).toJSDate();

      res.cookie(this.config.session.cookieName, token, {
        expires,
        httpOnly: true,
        path: '/',
        domain: this.config.session.cookieDomain,
      });

      return { user: userFromSession, powers };
    }

    return { token, user: userFromSession, powers };
  }

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Args('input') input: LoginInput,
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<LoginOutput> {
    const userId = await this.authService.login(input, session);
    const newSession = loggedInSession(await this.updateSession(req));
    const user = await this.userService.readOne(userId, newSession);
    const powers = await this.authorizationService.readPower(newSession);
    return { user, powers };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(
    @AnonSession() session: Session,
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
    @AnonSession() session: Session,
    @Context('request') req: Request
  ): Promise<RegisterOutput> {
    const result = await this.dbv4.post<RegisterOut>(
      'authentication/register',
      {
        user: input,
        token: session.token,
      }
    );

    if (result.error === ErrorCode.UNIQUENESS_VIOLATION) {
      throw new DuplicateException(
        'person.email',
        'Email address is already in use'
      );
    }

    const newSession = loggedInSession(await this.updateSession(req));
    return { user: result.user, powers: result.powers };
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
    @LoggedInSession() session: Session
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
