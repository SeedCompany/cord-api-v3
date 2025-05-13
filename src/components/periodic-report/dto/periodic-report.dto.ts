import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  CalendarDate,
  Resource,
  type ResourceShape,
  SecuredDateNullable,
  SecuredProperty,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { type BaseNode as DbBaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { type ScopedRole } from '../../authorization/dto';
import { type DefinedFile } from '../../file/dto';
import { ReportType } from './report-type.enum';

@RegisterResource({ db: e.PeriodicReport })
@Calculated()
@InterfaceType({
  resolveType: (obj: PeriodicReport) => `${obj.type}Report`,
  implements: [Resource],
})
class PeriodicReport extends Resource {
  static readonly Parent: ResourceShape<any>['Parent'] = 'dynamic';

  @Field(() => ReportType)
  readonly type: ReportType;

  @Field(() => Resource)
  readonly parent: DbBaseNode;

  @Field()
  readonly start: CalendarDate;

  @Field()
  readonly end: CalendarDate;

  @Field()
  readonly receivedDate: SecuredDateNullable;

  @Field()
  readonly skippedReason: SecuredStringNullable;

  readonly reportFile: DefinedFile;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  declare readonly scope: ScopedRole[];
}

export { PeriodicReport as IPeriodicReport };

@RegisterResource({ db: e.FinancialReport })
@ObjectType({
  implements: [PeriodicReport],
})
export class FinancialReport extends PeriodicReport {
  static readonly Parent = 'dynamic';

  declare readonly type: 'Financial';
}

@RegisterResource({ db: e.NarrativeReport })
@ObjectType({
  implements: [PeriodicReport],
})
export class NarrativeReport extends PeriodicReport {
  static readonly Parent = 'dynamic';

  declare readonly type: 'Narrative';
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured Periodic Report'),
})
export class SecuredPeriodicReport extends SecuredProperty(PeriodicReport) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    PeriodicReport: typeof PeriodicReport;
    FinancialReport: typeof FinancialReport;
    NarrativeReport: typeof NarrativeReport;
  }
  interface ResourceDBMap {
    PeriodicReport: typeof e.default.PeriodicReport;
    FinancialReport: typeof e.default.FinancialReport;
    NarrativeReport: typeof e.default.NarrativeReport;
  }
}
