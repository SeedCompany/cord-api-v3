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
  type GqlContextType,
  ServerException,
  UnauthenticatedException,
} from '~/common';
import { ConfigService, ILogger, Loader, type LoaderOf, Logger } from '~/core';
import { Privileges } from '../../../components/authorization';
import { Power } from '../../../components/authorization/dto';
import { UserLoader, UserService } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { HttpAdapter } from '../../http';
import { AuthenticationService } from '../authentication.service';
import { SessionOutput } from '../dto';
import { AuthLevel } from '../session/auth-level.decorator';
import { SessionHost } from '../session/session.host';
import { SessionInterceptor } from '../session/session.interceptor';

@Resolver(SessionOutput)
@AuthLevel('sessionless')
export class SessionResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly privileges: Privileges,
    private readonly config: ConfigService,
    private readonly sessionInt: SessionInterceptor,
    private readonly sessionHost: SessionHost,
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
    this.sessionHost.current$.next(session);

    const userFromSession = session.anonymous ? undefined : session.userId;

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie(
        context.request!,
      );
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
    const { impersonator } = session;
    if (session.anonymous || !impersonator) {
      return null;
    }
    // Edge case: Load the impersonator, as the impersonator, rather than the impersonatee.
    // They should still be able to see their own props from this field.
    // Otherwise, it could be that the impersonatee can't see the impersonator's roles,
    // and now the UI can't stop impersonating because it doesn't know the impersonator's roles.
    return await this.authentication.asUser(impersonator, () =>
      this.users.readOne(impersonator.userId),
    );
  }

  @ResolveField(() => [Power], { nullable: true })
  async powers(): Promise<Power[]> {
    return [...this.privileges.powers];
  }
}
