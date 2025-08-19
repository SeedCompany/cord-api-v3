import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  DbSort,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
} from '~/common';
import { sortingForEnumIndex } from '~/core/database/query';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { LanguageEngagement } from '../../engagement/dto';
import { type DefinedFile } from '../../file/dto';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ProgressReportCommunityStory } from './community-stories.dto';
import { ProgressReportHighlight } from './highlights.dto';
import {
  SecuredProgressReportStatus as SecuredStatus,
  ProgressReportStatus as Status,
} from './progress-report-status.enum';
import { ProgressReportTeamNews } from './team-news.dto';

const Interfaces = IntersectTypes(IPeriodicReport, Resource, Commentable);

@RegisterResource({ db: e.ProgressReport })
@ObjectType({
  implements: Interfaces.members,
})
export class ProgressReport extends Interfaces {
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.IEngagement);
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    highlights: [ProgressReportHighlight],
    teamNews: [ProgressReportTeamNews],
    communityStories: [ProgressReportCommunityStory],
    ...Commentable.Relations(),
  })) satisfies ResourceRelationsShape;

  declare readonly type: 'Progress';

  @Field(() => LanguageEngagement)
  declare readonly parent: BaseNode;

  /** @deprecated */
  declare readonly reportFile: DefinedFile;

  @Field(() => SecuredStatus)
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
