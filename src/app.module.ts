import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { OrganizationService } from './organization/organization.service';
import { OrganizationResolver } from './organization/organization.resolver';
import { DatabaseService } from './core/database.service';

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' })],
  controllers: [],
  providers: [OrganizationResolver, OrganizationService, DatabaseService],
})
export class AppModule {}
