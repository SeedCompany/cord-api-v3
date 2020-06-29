import { Module } from '@nestjs/common';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminModule } from './components/admin/admin.module';
import { AuthenticationModule } from './components/authentication/authentication.module';
import { AuthorizationModule } from './components/authorization/authorization.module';
import { BudgetModule } from './components/budget/budget.module';
import { CeremonyModule } from './components/ceremony/ceremony.module';
import { EngagementModule } from './components/engagement/engagement.module';
import { FavoriteModule } from './components/favorites/favorite.module';
import { FileModule } from './components/file/file.module';
import { LanguageModule } from './components/language/language.module';
import { LocationModule } from './components/location/location.module';
import { OrganizationModule } from './components/organization/organization.module';
import { PartnershipModule } from './components/partnership/partnership.module';
import { ProductModule } from './components/product/product.module';
import { ProjectModule } from './components/project/project.module';
import { SearchModule } from './components/search/search.module';
import { UserModule } from './components/user/user.module';
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
    FavoriteModule,
    UserModule,
    PartnershipModule,
    SearchModule,
    WorkflowModule,
  ],
  controllers: [],
  providers: [DateTimeScalar, DateScalar],
})
export class AppModule {}
