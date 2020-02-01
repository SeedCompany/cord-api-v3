import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GqlContextType } from './common';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminResolver } from './components/admin/admin.resolver';
import { AdminService } from './components/admin/admin.service';
import { AuthResolver } from './components/auth/auth.resolver';
import { AuthService } from './components/auth/auth.service';
import { BudgetResolver } from './components/budget/budget.resolver';
import { BudgetService } from './components/budget/budget.service';
import { InternshipResolver } from './components/internship/internship.resolver';
import { InternshipService } from './components/internship/internship.service';
import { InternshipEngagementResolver } from './components/internship-engagement/internship-engagement.resolver';
import { InternshipEngagementService } from './components/internship-engagement/internship-engagement.service';
import { LanguageModule } from './components/language';
import { LocationModule } from './components/location';
import { OrganizationModule } from './components/organization';
import { PartnershipResolver } from './components/partnership/partnership.resolver';
import { PartnershipService } from './components/partnership/partnership.service';
import { ProductResolver } from './components/product/product.resolver';
import { ProductService } from './components/product/product.service';
import { ProjectEngagementResolver } from './components/project-engagement/project-engagement.resolver';
import { ProjectEngagementService } from './components/project-engagement/project-engagement.service';
import { ProjectResolver } from './components/project/project.resolver';
import { ProjectService } from './components/project/project.service';
import { UserModule } from './components/user';
import { CoreModule, LoggerModule } from './core';

const context: ContextFunction<{ req: Request; res: Response }, GqlContextType> = ({
  req,
  res,
}) => ({
  token: req.header('token'),
});

@Module({
  imports: [
    LoggerModule.forRoot(),
    CoreModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      context,
    }),
    LanguageModule,
    LocationModule,
    OrganizationModule,
    UserModule,
  ],
  controllers: [],
  providers: [
    AdminResolver,
    AdminService,
    AuthResolver,
    AuthService,
    BudgetResolver,
    BudgetService,
    DateTimeScalar,
    DateScalar,
    InternshipResolver,
    InternshipService,
    InternshipEngagementResolver,
    InternshipEngagementService,
    ProductResolver,
    ProductService,
    ProjectEngagementResolver,
    ProjectEngagementService,
    ProjectResolver,
    ProjectService,
    PartnershipResolver,
    PartnershipService,
  ],
})
export class AppModule {}
