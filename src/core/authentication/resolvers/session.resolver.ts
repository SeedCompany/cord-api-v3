import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { type GqlContextType, ServerException } from '~/common';
import { ConfigService, Loader, type LoaderOf } from '~/core';
import { UserLoader, UserService } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { HttpAdapter } from '../../http';
import { SessionOutput } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';
import { SessionHost } from '../session/session.host';
import { SessionInitiator } from '../session/session.initiator';
import { SessionManager } from '../session/session.manager';

@Resolver(SessionOutput)
@AuthLevel(AuthLevel.Sessionless)
export class SessionResolver {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionInitiator: SessionInitiator,
    private readonly sessionHost: SessionHost,
    private readonly config: ConfigService,
    private readonly users: UserService,
    private readonly http: HttpAdapter,
  ) {}

  @Query(() => SessionOutput, {
    description: 'Create or retrieve an existing session',
  })
  async session(
    @Context() context: GqlContextType,
    @Args({
      name: 'browser',
      description:
        'Set to true to enable http cookie sessions for use in a browser-based environment.',
      type: () => Boolean,
      defaultValue: false,
    })
    browser?: boolean,
  ): Promise<SessionOutput> {
    const { request, response } = context;
    if (!request) {
      throw new ServerException('Cannot start session without a request');
    }
    const session = await this.sessionInitiator.start(request);
    // Set for data loaders invoked later in operation
    this.sessionHost.current$.next(session);

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie(request);
      if (!response) {
        throw new ServerException(
          'Cannot use cookie session without a response object',
        );
      }
      this.http.setCookie(response, name, session.token, {
        ...options,
        expires: expires
          ? DateTime.local().plus(expires).toJSDate()
          : undefined,
      });
    }

    return {
      token: !browser ? session.token : undefined,
      user: session.anonymous ? undefined : session.userId,
      session,
    };
  }

  @ResolveField(() => User, {
    nullable: true,
    description:
      'Only returned if there is a logged-in user tied to the current session.',
  })
  async user(
    @Parent() output: SessionOutput,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User | null> {
    return output.user ? await users.load(output.user) : null;
  }

  @ResolveField(() => User, {
    nullable: true,
    description:
      'The impersonator if the user is logged in and impersonating someone else',
  })
  async impersonator(
    @Parent() { session }: SessionOutput,
  ): Promise<User | null> {
    const { impersonator } = session;
    if (session.anonymous || !impersonator) {
      return null;
    }
    // Edge case: Load the impersonator, as the impersonator, rather than the impersonatee.
    // They should still be able to see their own props from this field.
    // Otherwise, it could be that the impersonatee can't see the impersonator's roles,
    // and now the UI can't stop impersonating because it doesn't know the impersonator's roles.
    return await this.sessionManager.asUser(impersonator, () =>
      this.users.readOne(impersonator.userId),
    );
  }
}
