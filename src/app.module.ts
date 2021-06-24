import { Module } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';
import { DateScalar, DateTimeScalar } from './common/luxon.graphql';
import { AdminModule } from './components/admin/admin.module';
import { AuthenticationModule } from './components/authentication/authentication.module';
import { AuthorizationModule } from './components/authorization/authorization.module';
import { BudgetModule } from './components/budget/budget.module';
import { CeremonyModule } from './components/ceremony/ceremony.module';
import { ChangesetModule } from './components/changeset/changeset.module';
import { EngagementModule } from './components/engagement/engagement.module';
import { FieldRegionModule } from './components/field-region/field-region.module';
import { FieldZoneModule } from './components/field-zone/field-zone.module';
import { FileModule } from './components/file/file.module';
import { FilmModule } from './components/film/film.module';
import { FundingAccountModule } from './components/funding-account/funding-account.module';
import { LanguageModule } from './components/language/language.module';
import { LiteracyMaterialModule } from './components/literacy-material/literacy-material.module';
import { LocationModule } from './components/location/location.module';
import { OrganizationModule } from './components/organization/organization.module';
import { PartnerModule } from './components/partner/partner.module';
import { PartnershipModule } from './components/partnership/partnership.module';
import { PeriodicReportModule } from './components/periodic-report/periodic-report.module';
import { PinModule } from './components/pin/pin.module';
import { PlanChangeModule } from './components/plan-change/plan-change.module';
import { PostModule } from './components/post/post.module';
import { PostableModule } from './components/post/postable/postable.module';
import { ProductModule } from './components/product/product.module';
import { ProgressSummaryModule } from './components/progress-summary/progress-summary.module';
import { ProjectModule } from './components/project/project.module';
import { ScriptureModule } from './components/scripture/scripture.module';
import { SearchModule } from './components/search/search.module';
import { SongModule } from './components/song/song.module';
import { StoryModule } from './components/story/story.module';
import { TimeZoneModule } from './components/timezone';
import { UserModule } from './components/user/user.module';
import { WorkflowModule } from './components/workflow/workflow.module';
import { CoreModule, LoggerModule } from './core';

assert(
  keys<{ foo: string }>().length === 1,
  'Sanity check for key transformer failed'
);

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
    FilmModule,
    LanguageModule,
    LiteracyMaterialModule,
    EngagementModule,
    ProductModule,
    ProjectModule,
    LocationModule,
    OrganizationModule,
    ScriptureModule,
    SongModule,
    StoryModule,
    UserModule,
    PartnershipModule,
    SearchModule,
    WorkflowModule,
    TimeZoneModule,
    PartnerModule,
    FundingAccountModule,
    FieldRegionModule,
    FieldZoneModule,
    PinModule,
    PostModule,
    PostableModule,
    PeriodicReportModule,
    ProgressSummaryModule,
    ChangesetModule,
    PlanChangeModule,
  ],
  controllers: [],
  providers: [DateTimeScalar, DateScalar],
})
export class AppModule {}
