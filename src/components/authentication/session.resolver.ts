import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  GqlContextType,
  ServerException,
  UnauthenticatedException,
} from '~/common';
import { ConfigService, ILogger, Loader, LoaderOf, Logger } from '~/core';
import { HttpAdapter } from '~/core/http';
import { Privileges } from '../authorization';
import { Power } from '../authorization/dto';
import { UserLoader, UserService } from '../user';
import { User } from '../user/dto';
import { AuthenticationService } from './authentication.service';
import { SessionOutput } from './dto';
import { SessionInterceptor } from './session.interceptor';

@Resolver(SessionOutput)
export class SessionResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly privileges: Privileges,
    private readonly config: ConfigService,
    private readonly sessionInt: SessionInterceptor,
    private readonly users: UserService,
    private readonly http: HttpAdapter,
    @Logger('session:resolver') private readonly logger: ILogger,
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
    const existingToken = this.sessionInt.getTokenFromContext(context);
    const impersonatee = this.sessionInt.getImpersonateeFromContext(context);

    let token = existingToken || (await this.authentication.createToken());
    let session;
    try {
      session = await this.authentication.resumeSession(token, impersonatee);
    } catch (exception) {
      if (!(exception instanceof UnauthenticatedException)) {
        throw exception;
      }
      this.logger.debug(
        'Failed to use existing session token, creating new one.',
        { exception },
      );
      token = await this.authentication.createToken();
      session = await this.authentication.resumeSession(token, impersonatee);
    }
    // Set for data loaders invoked later in operation
    context.session$.next(session);

    const userFromSession = session.anonymous ? undefined : session.userId;

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie;
      if (!context.response) {
        throw new ServerException(
          'Cannot use cookie session without a response object',
        );
      }
      this.http.setCookie(context.response, name, token, {
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
    if (session.anonymous || !session.impersonator) {
      return null;
    }
    // Edge case: Load the impersonator, as the impersonator, rather than the impersonatee.
    // They should still be able to see their own props from this field.
    // Otherwise, it could be that the impersonatee can't see the impersonator's roles,
    // and now the UI can't stop impersonating because it doesn't know the impersonator's roles.
    return await this.users.readOne(
      session.impersonator.userId,
      session.impersonator, // instead of `session`
    );
  }

  @ResolveField(() => [Power], { nullable: true })
  async powers(@Parent() output: SessionOutput): Promise<Power[]> {
    return [...this.privileges.forUser(output.session).powers];
  }
}
