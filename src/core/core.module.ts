import { Global, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GqlContextType } from '../common';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';

const context: ContextFunction<
  { req: Request; res: Response },
  GqlContextType
> = ({ req, res }) => ({
  request: req,
  response: res,
});

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      context,
      playground: true, // enabled in all environments
      introspection: true, // needed for playground
    }),
  ],
  providers: [AwsS3Factory],
  exports: [AwsS3Factory, ConfigModule, DatabaseModule, EmailModule],
})
export class CoreModule {}
