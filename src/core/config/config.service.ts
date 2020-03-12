import { Injectable } from '@nestjs/common';
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

  emailFrom = this.env.string('EMAIL_FROM').optional('noreply@cordfield.com');

  resetPasswordURL = this.env
    .string('RESET_PASSWORD_URL')
    .optional('https://cordfield.com/login/reset-password/');

  @Lazy() get neo4j() {
    const driverConfig: Neo4JDriverConfig = {
      maxTransactionRetryTime: 30_000,
    };
    return {
      url: this.env.string('NEO4J_URL').required(),
      username: this.env.string('NEO4J_USERNAME').required(),
      password: this.env.string('NEO4J_PASSWORD').required(),
      driverConfig,
    };
  }

  @Lazy() get files() {
    return {
      bucket: this.env.string('FILES_S3_BUCKET').optional('cord-field'),
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
