import { Injectable } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Config as Neo4JDriverConfig } from 'neo4j-driver/types/v1';
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
  globalPrefix = 'api';

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

  resetPasswordURL = this.env
    .string('RESET_PASSWORD_URL')
    .optional('https://cordfield.com/login/reset-password/');

  @Lazy() get neo4j() {
    const driverConfig: Neo4JDriverConfig = {
      maxTransactionRetryTime: 30_000,
    };
    return {
      url: this.env.string('NEO4J_URL').optional('bolt://localhost'),
      username: this.env.string('NEO4J_USERNAME').required(),
      password: this.env.string('NEO4J_PASSWORD').required(),
      driverConfig,
    };
  }

  dbIndexesCreate = this.env.boolean('DB_CREATE_INDEXES').optional(true);

  @Lazy() get files() {
    return {
      bucket: this.env.string('FILES_S3_BUCKET').optional('cord-field'),
    };
  }

  @Lazy() get rootAdmin() {
    return {
      email: this.env.string('ROOT_ADMIN_EMAIL').optional('devops@tsco.org'),
      password: this.env.string('ROOT_ADMIN_PASSWORD').optional('admin'),
    };
  }

  @Lazy() get cors(): CorsOptions {
    // regex is matched against origin which includes protocol and port (no path)
    // `cf\.com$` matches both root cf.com and all subdomains
    // `\/\/cf\.com$` matches only root cf.com
    const rawOrigin = this.env.string('CORS_ORIGIN').optional('*');
    const origin = rawOrigin === '*' ? rawOrigin : new RegExp(rawOrigin);
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
    },
  };

  constructor(private readonly env: EnvironmentService) {}
}
