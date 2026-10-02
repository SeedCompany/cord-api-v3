import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  Grandparent,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
} from '~/common';
import { type BaseNode, type LinkTo, RegisterResource } from '~/core/resources';
import { InternshipEngagement } from '../../engagement/dto';
import { type DefinedFile } from '../../file/dto';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { SecuredGtlReportStatus as SecuredStatus } from './gtl-report-status.enum';

/**
 * The quarterly report of a Global Translation Leader — an
 * `InternshipEngagement` (GTL is the Internship program under its new name).
 *
 * The sibling of `ProgressReport`, not an extension of it: both are rows on
 * `periodic_reports` told apart by `type`, both hang off an engagement, and
 * both are generated per fiscal quarter from the engagement's date range. The
 * content and the workflow differ, which is why it has its own status enum.
 *
 * The class name matters: `IPeriodicReport` resolves its concrete GraphQL type
 * as `` `${type}Report` ``, so the `GTL` report type must be exactly `GTLReport`.
 */
@RegisterResource()
@ObjectType({
  implements: [IPeriodicReport],
})
export class GTLReport extends IPeriodicReport {
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.InternshipEngagement);

  static readonly Relations = (() => ({
    ...Resource.Relations(),
  })) satisfies ResourceRelationsShape;

  declare readonly type: 'GTL';

  @Field(() => InternshipEngagement)
  declare readonly parent: BaseNode;

  /** The same engagement as `parent`, as a plain typed reference. */
  readonly engagement: LinkTo<'InternshipEngagement'>;

  declare readonly reportFile: DefinedFile;

  declare readonly narrativeFile: DefinedFile;

  // `Grandparent.store` lets the transitions resolver on the status type reach
  // back to this report, the way `Project.step` does.
  @Field(() => SecuredStatus, {
    middleware: [Grandparent.store],
  })
  @Calculated()
  readonly status: SecuredStatus;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured GTL report'),
})
export class SecuredGTLReport extends SecuredProperty(GTLReport) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GTLReport: typeof GTLReport;
  }
}
