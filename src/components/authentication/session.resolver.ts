import { forwardRef, Inject } from '@nestjs/common';
import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { UnauthenticatedException } from '../../common';
import { anonymousSession } from '../../common/session';
import { ConfigService, ILogger, Logger } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { SessionOutput } from './dto';
import { SessionPipe } from './session.pipe';

@Resolver()
export class SessionResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly repo: AuthenticationRepository,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService,
    private readonly config: ConfigService,
    private readonly sessionPipe: SessionPipe,
    @Logger('session:resolver') private readonly logger: ILogger
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

    let token = existingToken || (await this.authentication.createToken());
    let rawSession;
    try {
      rawSession = await this.authentication.createSession(token);
    } catch (exception) {
      if (!(exception instanceof UnauthenticatedException)) {
        throw exception;
      }
      this.logger.debug(
        'Failed to use existing session token, creating new one.',
        { exception }
      );
      token = await this.authentication.createToken();
      rawSession = await this.authentication.createSession(token);
    }
    const session = anonymousSession(rawSession);

    const userFromSession = session.anonymous
      ? null
      : await this.authentication.userFromSession(session);
    const powers = await this.authorization.readPower(session);

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie;
      res.cookie(name, token, {
        ...options,
        expires: expires
          ? DateTime.local().plus(expires).toJSDate()
          : undefined,
      });

      return { user: userFromSession, powers };
    }

    return { token, user: userFromSession, powers };
  }
}
