import { Global, Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_INTERCEPTOR,
  APP_PIPE,
  BaseExceptionFilter,
} from '@nestjs/core';
import { EmailModule } from '@seedcompany/nestjs-email';
import { ConsoleModule } from 'nestjs-console';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { CoreController } from './core.controller';
import { DataLoaderInterceptor } from './data-loader';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events';
import { ExceptionFilter } from './exception.filter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphQLConfig } from './graphql.config';
import { PostgresModule } from './postgres/postgres.module';
import { GraphqlModule } from './graphql';
import { ResourceResolver } from './resources';
import { TracingModule } from './tracing';
import { ValidationPipe } from './validation.pipe';

@Global()
@Module({
  imports: [
    ConfigModule,
    ConsoleModule,
    DatabaseModule,
    EmailModule.forRootAsync({ useExisting: ConfigService }),
    GraphqlModule,
    EventsModule,
    PostgresModule,
    TracingModule,
  ],
  providers: [
    AwsS3Factory,
    BaseExceptionFilter,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: DataLoaderInterceptor },
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
    PostgresModule,
    TracingModule,
  ],
})
export class CoreModule {}
