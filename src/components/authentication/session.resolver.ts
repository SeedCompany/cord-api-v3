import { forwardRef, Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { UnauthenticatedException } from '../../common';
import { anonymousSession } from '../../common/session';
import { ConfigService, DataLoader, ILogger, Loader, Logger } from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto';
import { User } from '../user';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { SessionOutput } from './dto';
import { SessionPipe } from './session.pipe';

@Resolver(SessionOutput)
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
    req.session = rawSession; // Set for data loaders invoked later in operation
    const session = anonymousSession(rawSession);

    const userFromSession = session.anonymous
      ? undefined
      : await this.repo.getUserFromSession(session);

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie;
      res.cookie(name, token, {
        ...options,
        expires: expires
          ? DateTime.local().plus(expires).toJSDate()
          : undefined,
      });

      return { user: userFromSession, session };
    }

    return { token, user: userFromSession, session };
  }

  @ResolveField(() => User, {
    nullable: true,
    description:
      'Only returned if there is a logged-in user tied to the current session.',
  })
  async user(
    @Parent() output: SessionOutput,
    @Loader(User) users: DataLoader<User>
  ): Promise<User | null> {
    return output.user ? await users.load(output.user) : null;
  }

  @ResolveField(() => [Powers], { nullable: true })
  async powers(@Parent() output: SessionOutput): Promise<Powers[]> {
    return await this.authorization.readPower(output.session);
  }
}
