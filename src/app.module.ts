import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { AreaResolver } from './components/area/area.resolver';
import { AreaService } from './components/area/area.service';
import { DatabaseService } from './core/database.service';
import { DatabaseUtility } from './common/database-utility';
import { LanguageResolver } from './components/language/language.resolver';
import { LanguageService } from './components/language/language.service';
import { LocationResolver } from './components/location/location.resolver';
import { LocationService } from './components/location/location.service';
import { OrganizationResolver } from './components/organization/organization.resolver';
import { OrganizationService } from './components/organization/organization.service';
import { ProjectResolver } from './components/project/project.resolver';
import { ProjectService } from './components/project/project.service';
import { RegionResolver } from './components/region/region.resolver';
import { RegionService } from './components/region/region.service';
import { UserResolver } from './components/user/user.resolver';
import { UserService } from './components/user/user.service';
import { ProductResolver } from './components/product/product.resolver';
import { ProductService } from './components/product/product.service';

@Module({
  imports: [GraphQLModule.forRoot({ autoSchemaFile: 'schema.gql' })],
  controllers: [],
  providers: [
    AreaResolver,
    AreaService,
    DatabaseService,
    DatabaseUtility,
    OrganizationResolver,
    OrganizationService,
    LanguageResolver,
    LanguageService,
    LocationResolver,
    LocationService,
    ProjectResolver,
    ProjectService,
    RegionResolver,
    RegionService,
    RegionResolver,
    UserService,
    UserResolver,
    ProductResolver,
    ProductService,
  ],
})
export class AppModule {}
