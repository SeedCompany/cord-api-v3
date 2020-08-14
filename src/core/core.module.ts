import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { CoreController } from './core.controller';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';
import { EventsModule } from './events';
import { ExceptionFilter } from './exception.filter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphQLConfig } from './graphql.config';
import { ValidationPipe } from './validation.pipe';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
    EventsModule,
  ],
  providers: [
    AwsS3Factory,
    GraphqlLoggingPlugin,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
  ],
  controllers: [CoreController],
  exports: [
    AwsS3Factory,
    ConfigModule,
    DatabaseModule,
    EmailModule,
    EventsModule,
  ],
})
export class CoreModule {}
