import { Injectable } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import {
  EmailModuleOptions,
  EmailOptionsFactory,
} from '@seedcompany/nestjs-email';
import { CookieOptions } from 'express';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Duration, DurationInput } from 'luxon';
import { Config as Neo4JDriverConfig } from 'neo4j-driver';
import { join } from 'path';
import { Merge } from 'type-fest';
import { ID, ServerException } from '../../common';
import { FrontendUrlWrapper } from '../email/templates/frontend-url';
import { LogLevel } from '../logger';
import { EnvironmentService } from './environment.service';

/**
 * Application configuration.
 * This is used to provide a higher level mapping from the raw environment.
 * Keys are camelcase, objects can be used, references to usages can be found.
 */
@Injectable()
export class ConfigService implements EmailOptionsFactory {
  port = this.env.number('port').optional(3000);
  // The port where the app is being hosted. i.e. a docker bound port
  publicPort = this.env.number('public_port').optional(this.port);
  hostUrl = this.env
    .string('host_url')
    .optional(`http://localhost:${this.publicPort}`);
  globalPrefix = '';

  /** Is this a jest process? */
  jest = Boolean(this.env.string('JEST_WORKER_ID').optional());

  // Should app be configured for migration?
  migration = this.env.boolean('MIGRATION').optional(false);

  jwtKey = this.env.string('JWT_AUTH_KEY').optional('cord-field');

  createEmailOptions(): EmailModuleOptions {
    const send = this.env.boolean('EMAIL_SEND').optional(false);
    return {
      from: this.env
        .string('EMAIL_FROM')
        .optional('CORD Field <noreply@cordfield.com>'),
      replyTo: this.env.string('EMAIL_REPLY_TO').optional() || undefined, // falsy -> undefined
      send,
      open:
        this.jest || this.migration
          ? false
          : this.env
              .boolean('EMAIL_OPEN')
              .optional(!send && process.env.NODE_ENV === 'development'),
      ses: {
        region: this.env.string('SES_REGION').optional(),
      },
      wrappers: [FrontendUrlWrapper(this.frontendUrl)],
    };
  }

  @Lazy() get email() {
    return {
      notifyDistributionLists: this.env
        .boolean('NOTIFY_DISTRIBUTION_LIST')
        .optional(false),
      notifyProjectStepChanges: this.env
        .boolean('NOTIFY_PROJECT_STEP_CHANGES')
        .optional(true),
    };
  }

  defaultTimeZone = this.env
    .string('DEFAULT_TIMEZONE')
    .optional('America/Chicago');

  frontendUrl = this.env
    .string('FRONTEND_URL')
    .optional('http://localhost:3001');

  // use this for postgres service
  @Lazy() get neo4j() {
    const driverConfig: Neo4JDriverConfig = {
      maxTransactionRetryTime: 30_000,
    };
    let url = this.env.string('NEO4J_URL').optional('bolt://localhost');
    const parsed = new URL(url);
    const username =
      parsed.username || this.env.string('NEO4J_USERNAME').optional('neo4j');
    const password =
      parsed.password || this.env.string('NEO4J_PASSWORD').optional('admin');
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
      url = parsed.toString();
    }
    return {
      url,
      username,
      password,
      driverConfig,
    };
  }
  //
  @Lazy() get postgres() {
    const host = this.env.string('PGHOST').optional('localhost');
    const user = this.env.string('PGUSER').optional('postgres');
    const password = this.env.string('PGPASSWORD').optional('password');
    const database = this.env.string('PGDATABASE').optional('postgres');
    const port = this.env.number('PGPORT').optional(5432);
    return {
      host,
      user,
      password,
      database,
      port,
    };
  }

  dbIndexesCreate = this.env.boolean('DB_CREATE_INDEXES').optional(true);
  dbAutoMigrate = this.env
    .boolean('DB_AUTO_MIGRATE')
    .optional(process.env.NODE_ENV !== 'production' && !this.jest);

  @Lazy() get files() {
    const bucket = this.env.string('FILES_S3_BUCKET').optional();
    const localDirectory = this.env
      .string('FILES_LOCAL_DIR')
      .optional(this.jest ? null : '.files');
    // Routes to LocalBucketController
    const baseUrl = join(this.hostUrl, this.globalPrefix, 'file');
    return {
      bucket,
      localDirectory,
      baseUrl,
      signedUrlExpires: Duration.fromObject({ minutes: 15 }),
    };
  }

  @Lazy() get rootAdmin() {
    let rootId: ID;
    return {
      get id(): ID {
        if (!rootId) {
          throw new ServerException(
            'Cannot access root admin ID before it is initialized'
          );
        }
        return rootId;
      },
      set id(newId: ID) {
        rootId = newId;
      },
      email: 'devops@tsco.org',
      password: this.env.string('ROOT_ADMIN_PASSWORD').optional('admin'),
    };
  }

  passwordSecret = this.env.string('PASSWORD_SECRET').optional();

  @Lazy() get rootSecurityGroup() {
    return {
      id: 'rootsgid',
    };
  }

  @Lazy() get publicSecurityGroup() {
    return {
      id: 'publicsgid',
    };
  }

  @Lazy() get defaultOrg() {
    return {
      id: '5c4278da9503d5cd78e82f02' as ID,
      name: 'Seed Company',
    };
  }

  @Lazy() get anonUser() {
    return {
      id: 'anonuserid',
    };
  }

  @Lazy() get cors(): CorsOptions {
    // regex is matched against origin which includes protocol and port (no path)
    // `cf\.com$` matches both root cf.com and all subdomains
    // `\/\/cf\.com$` matches only root cf.com
    const rawOrigin = this.env.string('CORS_ORIGIN').optional('*');
    // Always use regex instead of literal `*` so the current origin is returned
    // instead of `*`. fetch credentials="include" requires specific origin.
    const origin =
      rawOrigin === '*' ? /.*/ : rawOrigin.split(',').map((o) => new RegExp(o));
    return {
      origin,
      credentials: true,
    };
  }

  @Lazy() get sessionCookie(): Merge<
    CookieOptions,
    { name: string; expires?: DurationInput }
  > {
    const name = this.env.string('SESSION_COOKIE_NAME').optional('cordsession');

    let domain = this.env.string('SESSION_COOKIE_DOMAIN').optional();

    // Ensure sub-domains are allowed
    if (domain && !domain.startsWith('.')) {
      domain = '.' + domain;
    }

    return {
      name,
      domain,
      // Persist past current browser session
      expires: { years: 10 },
      // Cannot be retrieved by JS
      httpOnly: true,
      // All paths, not just the current one
      path: '/',
      // If env is configured for HTTPS
      ...(this.hostUrl.startsWith('https://') && {
        // Require HTTPS (required for SameSite)
        secure: true,
        // Allow 3rd party (other domains)
        sameSite: 'none',
      }),
    };
  }

  @Lazy() get xray() {
    return {
      daemonAddress: this.jest
        ? undefined
        : this.env.string('AWS_XRAY_DAEMON_ADDRESS').optional(),
    };
  }

  /**
   * @see https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint.html
   */
  readonly ecsMetadataUri =
    this.env.string('ECS_CONTAINER_METADATA_URI_V4').optional() ||
    this.env.string('ECS_CONTAINER_METADATA_URI').optional();

  /** Should logger output as JSON? Defaults to true if running in ECS */
  readonly jsonLogs = this.env
    .boolean('JSON_LOGS')
    .optional(!!this.ecsMetadataUri);

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
      version: LogLevel.DEBUG,
      'graphql:performance': LogLevel.NOTICE,
    },
  };

  constructor(private readonly env: EnvironmentService) {}
}
