import { Module } from '@nestjs/common';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminModule } from './components/admin';
import { AuthenticationModule } from './components/authentication';
import { AuthorizationModule } from './components/authorization';
import { BudgetModule } from './components/budget/budget.module';
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
import { WorkflowModule } from './components/workflow/workflow.module';
import { CoreModule, LoggerModule } from './core';

@Module({
  imports: [
    LoggerModule.forRoot(),
    CoreModule,
    AdminModule,
    AuthenticationModule,
    AuthorizationModule,
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
    WorkflowModule,
  ],
  controllers: [],
  providers: [DateTimeScalar, DateScalar],
})
export class AppModule {}
