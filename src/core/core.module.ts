import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { DataLoaderModule } from '@seedcompany/data-loader';
import { EmailModule } from '@seedcompany/nestjs-email';
import { ConsoleModule } from 'nestjs-console';
import { AwsS3Factory } from './aws-s3.factory';
import { CacheModule } from './cache/cache.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { CoreController } from './core.controller';
import { DataLoaderConfig } from './data-loader/data-loader.config';
import { DatabaseModule } from './database/database.module';
import { EdgedbModule } from './edgedb/edgedb.module';
import { EventsModule } from './events';
import { ExceptionFilter } from './exception/exception.filter';
import { ExceptionNormalizer } from './exception/exception.normalizer';
import { GraphqlModule } from './graphql';
import { PostgresModule } from './postgres/postgres.module';
import { ResourceModule } from './resources/resource.module';
import { ScalarProviders } from './scalars.resolver';
import { TimeoutInterceptor } from './timeout.interceptor';
import { TracingModule } from './tracing';
import { ValidationPipe } from './validation.pipe';
import { WaitResolver } from './wait.resolver';

@Global()
@Module({
  imports: [
    ConfigModule,
    CacheModule,
    ConsoleModule,
    DatabaseModule,
    DataLoaderModule.registerAsync({ useClass: DataLoaderConfig }),
    EdgedbModule,
    EmailModule.forRootAsync({ useExisting: ConfigService }),
    GraphqlModule,
    EventsModule,
    TracingModule,
    PostgresModule,
    ResourceModule,
  ],
  providers: [
    AwsS3Factory,
    ExceptionNormalizer,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    WaitResolver,
    ...ScalarProviders,
  ],
  controllers: [CoreController],
  exports: [
    AwsS3Factory,
    ConfigModule,
    CacheModule,
    GraphqlModule,
    DatabaseModule,
    DataLoaderModule,
    EdgedbModule,
    EmailModule,
    EventsModule,
    ResourceModule,
    TracingModule,
    PostgresModule,
  ],
})
export class CoreModule {}
