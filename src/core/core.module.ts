import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { CoreController } from './core.controller';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';
import { ExceptionFilter } from './exception.filter';
import { GraphQLConfig } from './graphql.config';
import { ValidationPipe } from './validation.pipe';
import { VersionService } from './version.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
  ],
  providers: [
    VersionService,
    AwsS3Factory,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
  ],
  controllers: [CoreController],
  exports: [AwsS3Factory, ConfigModule, DatabaseModule, EmailModule],
})
export class CoreModule {}
