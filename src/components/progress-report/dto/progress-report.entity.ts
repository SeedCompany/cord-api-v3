import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
  parentIdMiddleware,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
} from '~/common';
import { RegisterResource } from '~/core';
import { BaseNode } from '~/core/database/results';
import { LanguageEngagement } from '../../engagement/dto';
import { DefinedFile } from '../../file';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ReportType } from '../../periodic-report/dto/report-type.enum';
import { ProgressReportCommunityStory } from './community-stories.dto';
import { ProgressReportHighlight } from './hightlights.dto';
import { SecuredProgressReportStatus as SecuredStatus } from './progress-report-status.enum';
import { ProgressReportTeamNews } from './team-news.dto';

@RegisterResource()
@ObjectType({
  implements: [IPeriodicReport],
})
export class ProgressReport extends IPeriodicReport {
  static readonly Props = keysOf<ProgressReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressReport>>();
  static readonly Parent = import('../../engagement/dto').then(
    (m) => m.IEngagement,
  );
  static readonly Relations = {
    highlights: [ProgressReportHighlight],
    teamNews: [ProgressReportTeamNews],
    communityStories: [ProgressReportCommunityStory],
  } satisfies ResourceRelationsShape;

  declare readonly type: ReportType.Progress;

  @Field(() => LanguageEngagement)
  declare readonly parent: BaseNode;

  /** @deprecated */
  declare readonly reportFile: DefinedFile;

  @Field(() => SecuredStatus, {
    middleware: [parentIdMiddleware],
  })
  @Calculated()
  readonly status: SecuredStatus;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured progress report'),
})
export class SecuredProgressReport extends SecuredProperty(ProgressReport) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReport: typeof ProgressReport;
  }
}
