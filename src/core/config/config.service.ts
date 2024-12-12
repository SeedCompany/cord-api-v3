import { csv } from '@seedcompany/common';
import {
  EmailModuleOptions,
  EmailOptionsFactory,
} from '@seedcompany/nestjs-email';
import type { Server as HttpServer } from 'http';
import { LRUCache } from 'lru-cache';
import { Duration, DurationLike } from 'luxon';
import { nanoid } from 'nanoid';
import { Config as Neo4JDriverConfig } from 'neo4j-driver';
import { BehaviorSubject } from 'rxjs';
import { keys as keysOf } from 'ts-transformer-keys';
import { Class, Merge, ReadonlyDeep } from 'type-fest';
import { ID } from '~/common';
import { parseUri } from '../../components/file/bucket/parse-uri';
import { ProgressReportStatus } from '../../components/progress-report/dto/progress-report-status.enum';
import type { TransitionName as ProgressReportTransitionName } from '../../components/progress-report/workflow/transitions';
import { DefaultTimezoneWrapper } from '../email/templates/formatted-date-time';
import { FrontendUrlWrapper } from '../email/templates/frontend-url';
import type { CookieOptions, CorsOptions, IRequest } from '../http';
import { LogLevel } from '../logger/logger.interface';
import { EnvironmentService } from './environment.service';
import { determineRootUser } from './root-user.config';

const dur = Duration.from;

type AppConfig = ReadonlyDeep<InstanceType<ReturnType<typeof makeConfig>>>;

type HttpTimeoutOptions = AppConfig['httpTimeouts'];

const isDev = process.env.NODE_ENV === 'development';

export const makeConfig = (env: EnvironmentService) =>
  class ConfigService implements EmailOptionsFactory {
    port = env.number('port').optional(3000);
    // The port where the app is being hosted. i.e. a docker bound port
    publicPort = env.number('public_port').optional(this.port);
    hostUrl$ = new BehaviorSubject(
      env.url('host_url').optional(`http://localhost:${this.publicPort}`),
    );

    graphQL = {
      persistedQueries: {
        enabled: env.boolean('GRAPHQL_PERSISTED_QUERIES').optional(true),
        ttl: env.duration('GRAPHQL_PERSISTED_QUERIES_TTL').optional('1w'),
      },
    };
    hive = {
      token: env.string('HIVE_TOKEN').optional(),
    };

    lruCache = {
      ttl: env.duration('LRU_CACHE_TTL').optional()?.as('milliseconds'),
      max: env.number('LRU_CACHE_MAX').optional(),
      maxSize: env.number('LRU_CACHE_MAX_SIZE').optional('30MB'),
    } satisfies LRUCache.Options<string, unknown, unknown>;

    httpTimeouts = {
      /** @see HttpServer.keepAliveTimeout */
      keepAlive: env.duration('HTTP_KEEP_ALIVE_TIMEOUT').optional('5s'),
      /** @see HttpServer.headersTimeout */
      headers: env.duration('HTTP_HEADERS_TIMEOUT').optional('1m'),
      /** @see HttpServer.timeout */
      socket: env.duration('HTTP_SOCKET_TIMEOUT').optional(0),
      /** @see HttpServer.requestTimeout */
      request: env.duration('HTTP_REQUEST_TIMEOUT').optional(0),
    };

    applyTimeouts = (
      http: HttpServer,
      timeouts: Partial<HttpTimeoutOptions>,
    ) => {
      if (timeouts.keepAlive != null) {
        http.keepAliveTimeout = timeouts.keepAlive.toMillis();
      }
      if (timeouts.headers != null) {
        http.headersTimeout = timeouts.headers.toMillis();
      }
      if (timeouts.socket != null) {
        http.timeout = timeouts.socket.toMillis();
      }
      if (timeouts.request != null) {
        http.requestTimeout = timeouts.request.toMillis();
      }
    };

    /** Is this a REPL process? */
    isRepl = process.argv.join(' ').includes('repl');

    /** Is this a jest process? */
    jest = Boolean(env.string('JEST_WORKER_ID').optional());

    jwtKey = env.string('JWT_AUTH_KEY').optional('cord-field');

    createEmailOptions = () => {
      const send = env.boolean('EMAIL_SEND').optional(false);
      return {
        from: env
          .string('EMAIL_FROM')
          .optional('CORD Field <noreply@cordfield.com>'),
        replyTo: env.string('EMAIL_REPLY_TO').optional() || undefined, // falsy -> undefined
        send,
        open: this.jest
          ? false
          : env.boolean('EMAIL_OPEN').optional(!send && isDev),
        ses: {
          region: env.string('SES_REGION').optional(),
        },
        wrappers: [
          FrontendUrlWrapper(this.frontendUrl),
          DefaultTimezoneWrapper(this.defaultTimeZone),
        ],
      } satisfies EmailModuleOptions;
    };

    email = {
      notifyDistributionLists: env
        .boolean('NOTIFY_DISTRIBUTION_LIST')
        .optional(false),
      notifyProjectStepChanges: env
        .boolean('NOTIFY_PROJECT_STEP_CHANGES')
        .optional(true),
    };

    progressReportStatusChange = {
      enabled: env
        .boolean('NOTIFY_PROGRESS_REPORT_STATUS_CHANGES')
        .optional(this.createEmailOptions().send),
      notifyExtraEmails: {
        forTransitions: env
          .map('PROGRESS_REPORT_EMAILS_FOR_TRANSITIONS', {
            parseKey: keysOf<Record<ProgressReportTransitionName, ''>>(),
            parseValue: csv,
          })
          .optional({}),
        forBypasses: env
          .map('PROGRESS_REPORT_EMAILS_FOR_BYPASSES', {
            parseKey: ProgressReportStatus,
            parseValue: csv,
          })
          .optional({}),
      },
    };

    defaultTimeZone = env
      .string('DEFAULT_TIMEZONE')
      .optional('America/Chicago');

    frontendUrl = env.string('FRONTEND_URL').optional('http://localhost:3001');

    neo4j = (() => {
      const driverConfig: Neo4JDriverConfig = {};
      let url = env.string('NEO4J_URL').optional('bolt://localhost');
      const parsed = new URL(url);
      const username = env
        .string('NEO4J_USERNAME')
        .optional(parsed.username || 'neo4j');
      const password = env
        .string('NEO4J_PASSWORD')
        .optional(parsed.password || 'admin');
      const database =
        env.string('NEO4J_DBNAME').optional() ??
        (parsed.pathname.slice(1) || undefined);
      if (parsed.username || parsed.password || parsed.pathname) {
        parsed.username = '';
        parsed.password = '';
        parsed.pathname = '';
        url = parsed.toString();
      }
      return {
        url,
        username,
        password,
        database: this.jest
          ? `test.${nanoid().replace(/[-_]/g, '')}`
          : database,
        ephemeral: this.jest,
        driverConfig,
        isLocal: parsed.hostname === 'localhost',
      };
    })();

    // Control which database is prioritized, while we migrate.
    databaseEngine = env.string('DATABASE').optional('neo4j').toLowerCase();

    dbIndexesCreate = env
      .boolean('DB_CREATE_INDEXES')
      .optional(isDev ? this.neo4j.isLocal : true);
    dbAutoMigrate = env
      .boolean('DB_AUTO_MIGRATE')
      .optional(isDev && this.neo4j.isLocal && !this.jest);
    dbRootObjectsSync = env
      .boolean('DB_ROOT_OBJECTS_SYNC')
      .optional(isDev ? this.neo4j.isLocal : true);

    files = (() => {
      const legacyBucket = env.string('FILES_S3_BUCKET').optional();
      const sources = env
        .string('FILES_SOURCE')
        .optional(legacyBucket ? `s3://${legacyBucket}` : '.files')
        ?.split(',')
        .flatMap((src) => parseUri(src.trim()));
      return {
        sources: this.jest ? [] : sources,
        cacheTtl: {
          file: { private: dur('1h'), public: dur('1d') },
          version: { private: dur('1h'), public: dur('6d') },
        },
        putTtl: dur('10m'),
      };
    })();

    rootUser = determineRootUser(env);

    passwordSecret = env.string('PASSWORD_SECRET').optional();

    rootSecurityGroup = {
      id: 'rootsgid',
    };

    publicSecurityGroup = {
      id: 'publicsgid',
    };

    defaultOrg = {
      id: '5c4278da9503d5cd78e82f02' as ID,
      name: 'Seed Company',
    };

    anonUser = {
      id: 'anonuserid',
    };

    cors = (() => {
      // regex is matched against origin which includes protocol and port (no path)
      // `cf\.com$` matches both root cf.com and all subdomains
      // `\/\/cf\.com$` matches only root cf.com
      const rawOrigin = env.string('CORS_ORIGIN').optional('*');
      // Always use regex instead of literal `*` so the current origin is returned
      // instead of `*`. fetch credentials="include" requires specific origin.
      const origin =
        rawOrigin === '*'
          ? /.*/
          : rawOrigin.split(',').map((o) => new RegExp(o));
      return {
        origin,
        credentials: true,
      } satisfies CorsOptions;
    })();

    sessionCookie = (
      req: IRequest,
    ): Merge<CookieOptions, { name: string; expires?: DurationLike }> => {
      const name = env.string('SESSION_COOKIE_NAME').optional('cordsession');

      let domain = env.string('SESSION_COOKIE_DOMAIN').optional();

      // Ensure sub-domains are allowed
      if (domain && !domain.startsWith('.')) {
        domain = '.' + domain;
      }

      const userAgent = req.headers['user-agent'];
      const isSafari =
        userAgent && /^((?!chrome|android).)*safari/i.test(userAgent);

      return {
        name,
        domain,
        // Persist past current browser session
        expires: { years: 10 },
        // Cannot be retrieved by JS
        httpOnly: true,
        // All paths, not just the current one
        path: '/',
        ...(!(isSafari && isDev) && {
          // Require HTTPS (required for SameSite)
          secure: true,
          // Allow 3rd party (other domains)
          sameSite: 'none',
        }),
      };
    };

    xray = {
      daemonAddress: this.jest
        ? undefined
        : env.string('AWS_XRAY_DAEMON_ADDRESS').optional(),
    };

    redis = {
      url: env.string('REDIS_URL').optional(),
    };

    /**
     * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint.html
     */
    ecsMetadataUri =
      env.string('ECS_CONTAINER_METADATA_URI_V4').optional() ||
      env.string('ECS_CONTAINER_METADATA_URI').optional();

    /** Should logger output as JSON? Defaults to true if running in ECS */
    jsonLogs = env.boolean('JSON_LOGS').optional(!!this.ecsMetadataUri);
  };

// @ts-expect-error We will call makeConfig to create this shape.
// This just allows ConfigService to have the type correctly.
// Going through the hassle of a dynamic class is better
// because it allows NestJS injection and TS type at the same time.
const ConfigShape: Class<AppConfig> = class {};

/**
 * Application configuration.
 * This is used to provide a higher level mapping from the raw environment.
 * Keys are camelcase, objects can be used, references to usages can be found.
 */
export class ConfigService extends ConfigShape {
  /**
   * Default configuration for logging.
   * These can be overridden with logging.yml file at project root
   * This needs to be static to prevent circular dependency.
   */
  static logging = {
    defaultLevel: LogLevel.INFO,
    levels: {
      'nest,nest:*,-nest:loader': LogLevel.DEBUG,
      'nest:loader,nest:router': LogLevel.WARNING,
      'config:environment': LogLevel.INFO,
      'graphql:module': LogLevel.WARNING,
      version: LogLevel.DEBUG,
    },
  };
}
