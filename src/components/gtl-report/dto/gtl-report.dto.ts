import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  DbSort,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
} from '~/common';
import { sortingForEnumIndex } from '~/core/neo4j/query';
import { type BaseNode } from '~/core/neo4j/results';
import { RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { InternshipEngagement } from '../../engagement/dto';
import { type DefinedFile } from '../../file/dto';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import { GtlReportCommunityImpact } from './gtl-report-prose.dto';
import {
  SecuredGtlReportStatus as SecuredStatus,
  GtlReportStatus as Status,
} from './gtl-report-status.enum';

const Interfaces = IntersectTypes(IPeriodicReport, Resource, Commentable);

/**
 * The quarterly narrative report for a Global Translation Leader — Cord's
 * `InternshipEngagement`.
 *
 * Sibling of the Momentum `ProgressReport`, not an extension of it. Both are
 * rows on `periodic_reports` discriminated by `type`, both hang off an
 * engagement, and both are generated per fiscal quarter from the engagement's
 * date range. What differs is entirely the content: a GTL report carries goals,
 * practicum involvement, prayer and community impact rather than translation
 * progress against a PnP.
 *
 * The class name is load-bearing: `IPeriodicReport`'s `resolveType` is
 * `` `${obj.type}Report` ``, so the `GTL` report type resolves to exactly
 * `GTLReport`.
 *
 * Postgres-only — `@RegisterResource()` carries no Gel `db` type and the
 * `ResourceDBMap` half of the module augmentation is deliberately omitted,
 * following `Webhook` and the `audit` domain on develop.
 *
 * The workflow has its own status enum: GTL adds `PendingSupervisorSignOff`,
 * a state Momentum can never reach, and putting it on the shared enum would
 * surface it across Momentum's UI. @see `GtlReportStatus`, migration 0002
 */
@RegisterResource()
@ObjectType({
  implements: Interfaces.members,
})
export class GTLReport extends Interfaces {
  static readonly Parent = () =>
    import('../../engagement/dto').then((m) => m.InternshipEngagement);

  static readonly Relations = (() => ({
    ...Resource.Relations(),
    communityImpact: [GtlReportCommunityImpact],
    ...Commentable.Relations(),
  })) satisfies ResourceRelationsShape;

  declare readonly type: 'GTL';

  @Field(() => InternshipEngagement)
  declare readonly parent: BaseNode;

  declare readonly reportFile: DefinedFile;

  declare readonly narrativeFile: DefinedFile;

  @Field(() => SecuredStatus)
  @Calculated()
  @DbSort(sortingForEnumIndex(Status))
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
  // No ResourceDBMap entry — this resource has no Gel type.
}
