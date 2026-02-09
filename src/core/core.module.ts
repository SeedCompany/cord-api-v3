import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DataLoaderModule } from '@seedcompany/data-loader';
import { DiscoveryModule } from '@seedcompany/nest/discovery';
// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HooksModule } from '@seedcompany/nest/hooks';
import { EmailModule } from '@seedcompany/nestjs-email';
import { AuthenticationModule } from './authentication/authentication.module';
import { AwsS3Factory } from './aws-s3.factory';
import { BroadcasterModule } from './broadcast/broadcast.module';
import { CacheModule } from './cache/cache.module';
import { CliModule } from './cli/cli.module';
import { ConfigModule } from './config/config.module';
import { CoreController } from './core.controller';
import { DataLoaderConfig } from './data-loader/data-loader.config';
import { DatabaseModule } from './database/database.module';
import { EmailConfig } from './email/email.config';
import { ExceptionFilter } from './exception/exception.filter';
import { ExceptionNormalizer } from './exception/exception.normalizer';
import { GelModule } from './gel/gel.module';
import { GraphqlModule } from './graphql';
import { HttpModule } from './http';
import { LiveQueryModule } from './live-query/live-query.module';
import { ResourceModule } from './resources/resource.module';
import { ScalarProviders } from './scalars.resolver';
import { ShutdownHookProvider } from './shutdown.hook';
import { TimeoutInterceptor } from './timeout.interceptor';
import { TracingModule } from './tracing';
import { ValidationModule } from './validation/validation.module';
import { WaitResolver } from './wait.resolver';
import { WebhooksModule } from './webhooks/webhooks.module';

@Global()
@Module({
  imports: [
    HttpModule,
    ConfigModule,
    CacheModule,
    BroadcasterModule,
    CliModule,
    DatabaseModule,
    DataLoaderModule.registerAsync({ useClass: DataLoaderConfig }),
    GelModule,
    EmailModule.registerAsync({ useClass: EmailConfig }),
    DiscoveryModule,
    HooksModule,
    GraphqlModule,
    LiveQueryModule,
    TracingModule,
    ResourceModule,
    ValidationModule,
    AuthenticationModule,
    WebhooksModule,
  ],
  providers: [
    AwsS3Factory,
    ExceptionNormalizer,
    ExceptionFilter,
    { provide: APP_FILTER, useExisting: ExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    WaitResolver,
    ...ScalarProviders,
    ShutdownHookProvider,
  ],
  controllers: [CoreController],
  exports: [
    HttpModule,
    AwsS3Factory,
    ConfigModule,
    CacheModule,
    BroadcasterModule,
    GraphqlModule,
    LiveQueryModule,
    DatabaseModule,
    DataLoaderModule,
    DiscoveryModule,
    HooksModule,
    GelModule,
    EmailModule,
    ResourceModule,
    ShutdownHookProvider,
    TracingModule,
    ValidationModule,
    AuthenticationModule,
    WebhooksModule,
  ],
})
export class CoreModule {}
