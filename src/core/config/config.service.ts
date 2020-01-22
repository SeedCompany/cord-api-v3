import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Config as Neo4JDriverConfig } from 'neo4j-driver/types/v1';
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
      bucket: this.env.string('FILES_S3_BUCKET').required(),
    };
  }

  @Lazy() get aws() {
    return {
      accessKeyId: this.env.string('AWS_ACCESS_KEY_ID').required(),
      secretAccessKey: this.env.string('AWS_SECRET_ACCESS_KEY').required(),
      region: this.env.string('AWS_DEFAULT_REGION').optional('us-east-2'),
    };
  }

  constructor(private readonly env: EnvironmentService) {}
}
