import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { LanguageEngagement } from '../../engagement/dto';
import { type DefinedFile } from '../../file/dto';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { ProgressReportCommunityStory } from './community-stories.dto';
import { ProgressReportHighlight } from './highlights.dto';
import { SecuredProgressReportStatus as SecuredStatus } from './progress-report-status.enum';
import { ProgressReportTeamNews } from './team-news.dto';

const Interfaces = IntersectTypes(IPeriodicReport, Resource, Commentable);

@RegisterResource()
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

  readonly engagement: LinkTo<'LanguageEngagement'>;

  @Field(() => LanguageEngagement)
  declare readonly parent?: never;

  declare readonly reportFile: DefinedFile;

  declare readonly narrativeFile: DefinedFile;

  @Field(() => SecuredStatus)
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
