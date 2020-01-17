import { AdminResolver } from './components/admin/admin.resolver';
import { AdminService } from './components/admin/admin.service';
import { AreaResolver } from './components/area/area.resolver';
import { AreaService } from './components/area/area.service';
import { AuthResolver } from './components/auth/auth.resolver';
import { AuthService } from './components/auth/auth.service';
import { BudgetResolver } from './components/budget/budget.resolver';
import { BudgetService } from './components/budget/budget.service';
import { DatabaseService } from './core/database.service';
import { GraphQLModule } from '@nestjs/graphql';
import { InternshipResolver } from './components/internship/internship.resolver';
import { InternshipService } from './components/internship/internship.service';
import { LanguageResolver } from './components/language/language.resolver';
import { LanguageService } from './components/language/language.service';
import { LocationResolver } from './components/location/location.resolver';
import { LocationService } from './components/location/location.service';
import { Module } from '@nestjs/common';
import { OrganizationResolver } from './components/organization/organization.resolver';
import { OrganizationService } from './components/organization/organization.service';
import { ProductResolver } from './components/product/product.resolver';
import { ProductService } from './components/product/product.service';
import { ProjectResolver } from './components/project/project.resolver';
import { ProjectService } from './components/project/project.service';
import { RegionResolver } from './components/region/region.resolver';
import { RegionService } from './components/region/region.service';
import { UserResolver } from './components/user/user.resolver';
import { UserService } from './components/user/user.service';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      context: ({ req, res }) => ({ req, res }),
    }),
  ],

  controllers: [],
  providers: [
    AdminResolver,
    AdminService,
    AreaResolver,
    AreaService,
    AuthResolver,
    AuthService,
    BudgetResolver,
    BudgetService,
    DatabaseService,
    InternshipResolver,
    InternshipService,
    LanguageResolver,
    LanguageService,
    LocationResolver,
    LocationService,
    OrganizationResolver,
    OrganizationService,
    ProductResolver,
    ProductService,
    ProjectResolver,
    ProjectService,
    RegionResolver,
    RegionResolver,
    RegionService,
    UserResolver,
    UserService,
  ],
})
export class AppModule {}
