import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import {
  Calculated,
  CalendarDate,
  Resource,
  ResourceShape,
  SecuredDateNullable,
  SecuredProperty,
  SecuredProps,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { BaseNode as DbBaseNode } from '../../../core/database/results';
import { ScopedRole } from '../../authorization';
import { DefinedFile } from '../../file';
import { ReportType } from './report-type.enum';

@RegisterResource()
@Calculated()
@InterfaceType({
  resolveType: (obj: PeriodicReport) =>
    // Prevent circular dependency by lazily importing this.
    // This file has the concretes which depend on the interface defined here
    // so this interface file needs to finish loading before the merge file
    // can be loaded
    import('./merge-periodic-reports.dto').then((m) =>
      m.resolveReportType(obj),
    ),
  implements: [Resource],
})
class PeriodicReport extends Resource {
  static readonly Props: string[] = keysOf<PeriodicReport>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<PeriodicReport>>();
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

@RegisterResource()
@ObjectType({
  implements: [PeriodicReport],
})
export class FinancialReport extends PeriodicReport {
  static readonly Props = keysOf<FinancialReport>();
  static readonly SecuredProps = keysOf<SecuredProps<FinancialReport>>();
  static readonly Parent = 'dynamic';

  declare readonly type: ReportType.Financial;
}

@RegisterResource()
@ObjectType({
  implements: [PeriodicReport],
})
export class NarrativeReport extends PeriodicReport {
  static readonly Props = keysOf<NarrativeReport>();
  static readonly SecuredProps = keysOf<SecuredProps<NarrativeReport>>();
  static readonly Parent = 'dynamic';

  declare readonly type: ReportType.Narrative;
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
}
