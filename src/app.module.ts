import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { DatabaseService } from './core/database.service';
import { OrganizationService } from './components/organization/organization.service';
import { OrganizationResolver } from './components/organization/organization.resolver';
import { LanguageResolver } from './components/language/language.resolver';
import { LanguageService } from './components/language/language.service';
import { LocationResolver } from './components/location/location.resolver';
import { DatabaseUtility } from './common/database-utility';
import { LocationService } from './components/location/location.service';
import { UserResolver } from './components/user/user.resolver';
import { UserService } from './components/user/user.service';

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' })],
  controllers: [],
  providers: [
    DatabaseService,
    DatabaseUtility,
    OrganizationResolver,
    OrganizationService,
    LanguageResolver,
    LanguageService,
    LocationResolver,
    LocationService,
    UserResolver,
    UserService,
  ],
})
export class AppModule {}
