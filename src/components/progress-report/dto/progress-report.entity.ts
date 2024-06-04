import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
  DbSort,
  parentIdMiddleware,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
} from '~/common';
import { sortingForEnumIndex } from '~/core/database/query';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { LanguageEngagement } from '../../engagement/dto';
import { DefinedFile } from '../../file/dto';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ProgressReportCommunityStory } from './community-stories.dto';
import { ProgressReportHighlight } from './highlights.dto';
import {
  SecuredProgressReportStatus as SecuredStatus,
  ProgressReportStatus as Status,
} from './progress-report-status.enum';
import { ProgressReportTeamNews } from './team-news.dto';

@RegisterResource({ db: e.ProgressReport })
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

  declare readonly type: 'Progress';

  @Field(() => LanguageEngagement)
  declare readonly parent: BaseNode;

  /** @deprecated */
  declare readonly reportFile: DefinedFile;

  @Field(() => SecuredStatus, {
    middleware: [parentIdMiddleware],
  })
  @Calculated()
  @DbSort(sortingForEnumIndex(Status))
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
  interface ResourceDBMap {
    ProgressReport: typeof e.default.ProgressReport;
  }
}
