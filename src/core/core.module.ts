import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, BaseExceptionFilter } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { EmailModule } from '@seedcompany/nestjs-email';
import { ConsoleModule } from 'nestjs-console';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { CoreController } from './core.controller';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events';
import { ExceptionFilter } from './exception.filter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphQLConfig } from './graphql.config';
import { PubSubModule } from './pub-sub';
import { ResourceResolver } from './resources';
import { ValidationPipe } from './validation.pipe';

@Global()
@Module({
  imports: [
    ConfigModule,
    ConsoleModule,
    DatabaseModule,
    EmailModule.forRootAsync({ useExisting: ConfigService }),
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
    PubSubModule,
    EventsModule,
  ],
  providers: [
    AwsS3Factory,
    GraphqlLoggingPlugin,
    BaseExceptionFilter,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
    ResourceResolver,
  ],
  controllers: [CoreController],
  exports: [
    AwsS3Factory,
    ConfigModule,
    DatabaseModule,
    EmailModule,
    EventsModule,
    ResourceResolver,
  ],
})
export class CoreModule {}
