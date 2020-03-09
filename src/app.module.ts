import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GqlContextType } from './common';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminResolver } from './components/admin/admin.resolver';
import { AdminService } from './components/admin/admin.service';
import { AuthModule } from './components/auth';
import { BudgetResolver } from './components/budget/budget.resolver';
import { BudgetService } from './components/budget/budget.service';
import { FileModule } from './components/file';
import { InternshipEngagementResolver } from './components/internship-engagement/internship-engagement.resolver';
import { InternshipEngagementService } from './components/internship-engagement/internship-engagement.service';
import { LanguageModule } from './components/language';
import { LocationModule } from './components/location';
import { OrganizationModule } from './components/organization';
import { PartnershipModule } from './components/partnership/partnership.module';
import { ProductModule } from './components/product';
import { ProjectModule } from './components/project';
import { ProjectEngagementResolver } from './components/project-engagement/project-engagement.resolver';
import { ProjectEngagementService } from './components/project-engagement/project-engagement.service';
import { UserModule } from './components/user';
import { CoreModule, LoggerModule } from './core';

const context: ContextFunction<
  { req: Request; res: Response },
  GqlContextType
> = ({ req }) => ({
  request: req,
});

@Module({
  imports: [
    LoggerModule.forRoot(),
    CoreModule,
    GraphQLModule.forRoot({
      autoSchemaFile: 'schema.gql',
      context,
      playground: true, // enabled in all environments
    }),
    AuthModule,
    FileModule,
    LanguageModule,
    ProductModule,
    ProjectModule,
    LocationModule,
    OrganizationModule,
    UserModule,
    PartnershipModule,
  ],
  controllers: [],
  providers: [
    AdminResolver,
    AdminService,
    BudgetResolver,
    BudgetService,
    DateTimeScalar,
    DateScalar,
    InternshipEngagementResolver,
    InternshipEngagementService,
    ProjectEngagementResolver,
    ProjectEngagementService,
  ],
})
export class AppModule {}
