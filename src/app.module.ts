import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GqlContextType } from './common';
import { AdminResolver } from './components/admin/admin.resolver';
import { AdminService } from './components/admin/admin.service';
import { AreaResolver } from './components/area/area.resolver';
import { AreaService } from './components/area/area.service';
import { AuthResolver } from './components/auth/auth.resolver';
import { AuthService } from './components/auth/auth.service';
import { BudgetResolver } from './components/budget/budget.resolver';
import { BudgetService } from './components/budget/budget.service';
import { ConfigModule } from './core/config/config.module';
import { CypherFactory } from './core/cypher.factory';
import { DatabaseService } from './core/database.service';
import { InternshipResolver } from './components/internship/internship.resolver';
import { InternshipService } from './components/internship/internship.service';
import { LanguageResolver } from './components/language/language.resolver';
import { LanguageService } from './components/language/language.service';
import { LocationResolver } from './components/location/location.resolver';
import { LocationService } from './components/location/location.service';
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
import { PartnershipResolver } from './components/partnership/partnership.resolver';
import { PartnershipService } from './components/partnership/partnership.service';

const context: ContextFunction<{ req: Request; res: Response }, GqlContextType> = ({
  req,
  res,
}) => ({
  token: req.header('token'),
});

@Module({
  imports: [
    ConfigModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      context,
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
    CypherFactory,
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
    PartnershipResolver,
    PartnershipService,
  ],
})
export class AppModule {}
