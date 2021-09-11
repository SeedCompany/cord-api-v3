import { forwardRef, Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { GqlContextType, UnauthenticatedException } from '../../common';
import { anonymousSession } from '../../common/session';
import {
  ConfigService,
  DataLoader,
  ILogger,
  Loader,
  Logger,
  PostgresService,
} from '../../core';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto';
import { User } from '../user';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { SessionOutput } from './dto';
import { SessionInterceptor } from './session.interceptor';

@Resolver(SessionOutput)
export class SessionResolver {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly repo: AuthenticationRepository,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorization: AuthorizationService,
    private readonly config: ConfigService,
    // private readonly sessionPipe: SessionPipe,
    private readonly pg: PostgresService,
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
    // creates the schema
    await this.pg.init(1);
    // populate the schema with sample data
    await this.pg.loadTestData(1);
    // const preparedStatement1 = `select neo4j_id from public.people_data where id =$1`;
    // const result1 = await this.pg.pool.query(preparedStatement1, [1]);
    // console.log(result1.rows[0].neo4j_id);

    // const preparedStatement2 = `select id from $1 where id = 0 limit 1`;
    // const result2 = await this.pg.pool.query(preparedStatement2, [
    //   'public.users_data',
    // ]);
    // console.log(result2.rows[0].id);
    // const existingToken =
    //   this.sessionPipe.getTokenFromAuthHeader(req) ||
    //   this.sessionPipe.getTokenFromCookie(req);
    // console.log('existingToken', existingToken);
    const existingToken = this.sessionInt.getTokenFromContext(context);

    let token = existingToken || (await this.authentication.createToken());
    console.log('token', token);
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
    context.session = rawSession; // Set for data loaders invoked later in operation
    const session = anonymousSession(rawSession);
    const userFromSession = session.anonymous
      ? undefined
      : await this.repo.getUserFromSession(session);
    console.log({ token, user: userFromSession, session });
    if (browser) {
      const { name, expires, ...options } = this.config.sessionCookie;
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
    @Loader(User) users: DataLoader<User>
  ): Promise<User | null> {
    return output.user ? await users.load(output.user) : null;
  }

  @ResolveField(() => [Powers], { nullable: true })
  async powers(@Parent() output: SessionOutput): Promise<Powers[]> {
    return await this.authorization.readPower(output.session);
  }
}
