import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { DatabaseService } from './core/database.service';
import { OrganizationService } from './modules/organization/organization.service';
import { OrganizationResolver } from './modules/organization/organization.resolver';
import { LanguageResolver } from './modules/language/language.resolver';
import { LanguageService } from './modules/language/language.service';
import { LocationService } from './modules/location/location.service';
import { LocationResolver } from './modules/location/location.resolver';

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' })],
  controllers: [],
  providers: [
    DatabaseService,
    OrganizationResolver,
    OrganizationService,
    LanguageResolver,
    LanguageService,
    LocationResolver,
    LocationService,
  ],
})
export class AppModule {}
