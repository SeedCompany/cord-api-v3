import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { DatabaseService } from './core/database.service';
import { OrganizationService } from './components/organization/organization.service';
import { OrganizationResolver } from './components/organization/organization.resolver';
import { LanguageResolver } from './components/language/language.resolver';
import { LanguageService } from './components/language/language.service';
import { LocationService } from './components/location/location.service';
import { LocationResolver } from './components/location/location.resolver';

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
