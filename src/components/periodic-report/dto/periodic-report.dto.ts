import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  CalendarDate,
  Resource,
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

@InterfaceType({
  resolveType: (obj: PeriodicReport) =>
    // Prevent circular dependency by lazily importing this.
    // This file has the concretes which depend on the interface defined here
    // so this interface file needs to finish loading before the merge file
    // can be loaded
    import('./merge-periodic-report.dto').then((m) => m.resolveReportType(obj)),
  implements: [Resource],
})
class PeriodicReport extends Resource {
  static readonly Props: string[] = keysOf<PeriodicReport>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<PeriodicReport>>();

  @Field(() => ReportType)
  readonly type: ReportType;

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
  readonly scope: ScopedRole[];
}

export { PeriodicReport as IPeriodicReport };

@ObjectType({
  implements: [PeriodicReport],
})
export class FinancialReport extends PeriodicReport {
  static readonly Props = keysOf<FinancialReport>();
  static readonly SecuredProps = keysOf<SecuredProps<FinancialReport>>();

  readonly type: ReportType.Financial;
}

@ObjectType({
  implements: [PeriodicReport],
})
export class ProgressReport extends PeriodicReport {
  static readonly Props = keysOf<ProgressReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressReport>>();

  readonly type: ReportType.Progress;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured Periodic Report'),
})
export class SecuredPeriodicReport extends SecuredProperty(PeriodicReport) {}
