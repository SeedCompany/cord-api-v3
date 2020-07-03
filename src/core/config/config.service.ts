import { Injectable } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Duration } from 'luxon';
import { Config as Neo4JDriverConfig } from 'neo4j-driver/types/v1';
import { join } from 'path';
import { LogLevel } from '../logger';
import { EnvironmentService } from './environment.service';

/**
 * Application configuration.
 * This is used to provide a higher level mapping from the raw environment.
 * Keys are camelcase, objects can be used, references to usages can be found.
 */
@Injectable()
export class ConfigService {
  port = this.env.number('port').optional(3000);
  hostUrl = this.env
    .string('host_url')
    .optional(`http://localhost:${this.port}`);
  globalPrefix = '';

  /** Is this a jest process? */
  jest = Boolean(this.env.string('JEST_WORKER_ID').optional());

  jwtKey = this.env.string('JWT_AUTH_KEY').optional('cord-field');

  @Lazy() get email() {
    const send = this.env.boolean('EMAIL_SEND').optional(false);
    return {
      from: this.env.string('EMAIL_FROM').optional('noreply@cordfield.com'),
      replyTo: this.env.string('EMAIL_REPLY_TO').optional() || undefined, // falsy -> undefined
      send,
      open: this.env.boolean('EMAIL_OPEN').optional(!send),
    };
  }

  frontendUrl = this.env
    .string('FRONTEND_URL')
    .optional('http://localhost:3001');

  resetPasswordUrl = (token: string) =>
    `${this.frontendUrl}/reset-password/${token}`;

  @Lazy() get neo4j() {
    const driverConfig: Neo4JDriverConfig = {
      maxTransactionRetryTime: 30_000,
    };
    let url = this.env.string('NEO4J_URL').optional('bolt://localhost');
    const parsed = new URL(url);
    const username =
      parsed.username || this.env.string('NEO4J_USERNAME').required();
    const password =
      parsed.password || this.env.string('NEO4J_PASSWORD').required();
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

  dbIndexesCreate = this.env.boolean('DB_CREATE_INDEXES').optional(true);

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
    return {
      id: 'rootadminid',
      email: 'devops@tsco.org',
      password: this.env.string('ROOT_ADMIN_PASSWORD').optional('admin'),
    };
  }

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
      id: 'seedcompanyid',
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

  @Lazy() get session(): {
    cookieName: string;
    cookieDomain: string | undefined;
  } {
    const cookieName = this.env
      .string('SESSION_COOKIE_NAME')
      .optional('cordsession');

    let cookieDomain = this.env.string('SESSION_COOKIE_DOMAIN').optional();

    // prepend a leading "." to the domain if one doesn't exist, to ensure cookies are cross-domain-enabled
    if (cookieDomain && !cookieDomain.startsWith('.')) {
      cookieDomain = '.' + cookieDomain;
    }

    return {
      cookieName,
      cookieDomain,
    };
  }

  /**
   * Default configuration for logging.
   * These can be overridden with logging.yml file at project root
   * This needs to be static to prevent circular dependency.
   */
  static logging = {
    defaultLevel: LogLevel.INFO,
    levels: {
      'nest,nest:*': LogLevel.DEBUG,
      'config:environment': LogLevel.INFO,
      version: LogLevel.DEBUG,
    },
  };

  constructor(private readonly env: EnvironmentService) {}
}
