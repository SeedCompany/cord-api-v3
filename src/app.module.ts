import { Module } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';
import { AdminModule } from './components/admin/admin.module';
import { AuthenticationModule } from './components/authentication/authentication.module';
import { AuthorizationModule } from './components/authorization/authorization.module';
import { BudgetModule } from './components/budget/budget.module';
import { CeremonyModule } from './components/ceremony/ceremony.module';
import { ChangesetModule } from './components/changeset/changeset.module';
import { CommentModule } from './components/comments/comment.module';
import { EngagementModule } from './components/engagement/engagement.module';
import { EthnoArtModule } from './components/ethno-art/ethno-art.module';
import { FieldRegionModule } from './components/field-region/field-region.module';
import { FieldZoneModule } from './components/field-zone/field-zone.module';
import { FileModule } from './components/file/file.module';
import { FilmModule } from './components/film/film.module';
import { FundingAccountModule } from './components/funding-account/funding-account.module';
import { LanguageModule } from './components/language/language.module';
import { LocationModule } from './components/location/location.module';
import { OrganizationModule } from './components/organization/organization.module';
import { PartnerModule } from './components/partner/partner.module';
import { PartnershipProducingMediumModule } from './components/partnership-producing-medium/partnership-producing-medium.module';
import { PartnershipModule } from './components/partnership/partnership.module';
import { PeriodicReportModule } from './components/periodic-report/periodic-report.module';
import { PinModule } from './components/pin/pin.module';
import { PostModule } from './components/post/post.module';
import { ProductProgressModule } from './components/product-progress/product-progress.module';
import { ProductModule } from './components/product/product.module';
import { ProgressReportModule } from './components/progress-report/progress-report.module';
import { ProgressSummaryModule } from './components/progress-summary/progress-summary.module';
import { ProjectChangeRequestModule } from './components/project-change-request/project-change-request.module';
import { ProjectModule } from './components/project/project.module';
import { PromptsModule } from './components/prompts/prompts.module';
import { ScriptureModule } from './components/scripture';
import { SearchModule } from './components/search/search.module';
import { StoryModule } from './components/story/story.module';
import { TimeZoneModule } from './components/timezone';
import { UserModule } from './components/user/user.module';
import { CoreModule, LoggerModule } from './core';

assert(
  keys<{ foo: string }>().length === 1,
  'Sanity check for key transformer failed',
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
    CommentModule,
    EthnoArtModule,
    FileModule,
    FilmModule,
    LanguageModule,
    EngagementModule,
    ProductModule,
    ProjectModule,
    LocationModule,
    OrganizationModule,
    ScriptureModule,
    StoryModule,
    UserModule,
    PartnershipModule,
    SearchModule,
    TimeZoneModule,
    PartnerModule,
    FundingAccountModule,
    FieldRegionModule,
    FieldZoneModule,
    PinModule,
    PostModule,
    PeriodicReportModule,
    ProgressSummaryModule,
    ChangesetModule,
    ProjectChangeRequestModule,
    ProductProgressModule,
    PartnershipProducingMediumModule,
    ProgressReportModule,
    PromptsModule,
  ],
})
export class AppModule {}
