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
} from '../../common';
import { ConfigService, ILogger, Loader, LoaderOf, Logger } from '../../core';
import { Powers as Power, Privileges } from '../authorization';
import { User, UserLoader } from '../user';
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
    @Logger('session:resolver') private readonly logger: ILogger
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
    browser?: boolean
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
        { exception }
      );
      token = await this.authentication.createToken();
      session = await this.authentication.resumeSession(token, impersonatee);
    }
    context.session = session; // Set for data loaders invoked later in operation

    const userFromSession = session.anonymous ? undefined : session.userId;

    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie;
      if (!context.response) {
        throw new ServerException(
          'Cannot use cookie session without a response object'
        );
      }
      context.response.cookie(name, token, {
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
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<User | null> {
    return output.user ? await users.load(output.user) : null;
  }

  @ResolveField(() => [Power], { nullable: true })
  async powers(@Parent() output: SessionOutput): Promise<Power[]> {
    return [...this.privileges.forUser(output.session).powers];
  }
}
