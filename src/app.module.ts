import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GqlContextType } from './common';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminResolver } from './components/admin/admin.resolver';
import { AdminService } from './components/admin/admin.service';
import { AuthModule } from './components/auth';
import { BudgetModule } from './components/budget/budget.module';
import { BudgetResolver } from './components/budget/budget.resolver';
import { BudgetService } from './components/budget/budget.service';
import { CeremonyModule } from './components/ceremony';
import { EngagementModule } from './components/engagement';
import { FileModule } from './components/file';
import { LanguageModule } from './components/language';
import { LocationModule } from './components/location';
import { OrganizationModule } from './components/organization';
import { PartnershipModule } from './components/partnership';
import { ProductModule } from './components/product';
import { ProjectModule } from './components/project';
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
      introspection: true, // needed for playground
    }),
    AuthModule,
    BudgetModule,
    CeremonyModule,
    FileModule,
    LanguageModule,
    EngagementModule,
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
  ],
})
export class AppModule {}
