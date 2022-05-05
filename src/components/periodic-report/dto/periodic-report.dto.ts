import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  CalendarDate,
  Resource,
  SecuredDateNullable,
  SecuredProperty,
  SecuredProps,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  ServerException,
  simpleSwitch,
} from '../../../common';
import { BaseNode as DbBaseNode } from '../../../core/database/results';
import { ScopedRole } from '../../authorization';
import { DefinedFile } from '../../file';
import { SecuredProgressVarianceReasons } from './progress-variance-reason.enum';
import { ReportType } from './report-type.enum';

type AnyPeriodicReport = MergeExclusive<
  MergeExclusive<FinancialReport, NarrativeReport>,
  ProgressReport
>;

export const resolveReportType = (report: Pick<PeriodicReport, 'type'>) => {
  const type = simpleSwitch(report.type, {
    Financial: FinancialReport,
    Narrative: NarrativeReport,
    Progress: ProgressReport,
  });
  if (!type) {
    throw new ServerException('Could not resolve periodic report type');
  }
  return type;
};

@InterfaceType({
  resolveType: resolveReportType,
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

export {
  PeriodicReport as IPeriodicReport,
  AnyPeriodicReport as PeriodicReport,
};

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
export class NarrativeReport extends PeriodicReport {
  static readonly Props = keysOf<NarrativeReport>();
  static readonly SecuredProps = keysOf<SecuredProps<NarrativeReport>>();

  readonly type: ReportType.Narrative;
}

@ObjectType({
  implements: [PeriodicReport],
})
export class ProgressReport extends PeriodicReport {
  static readonly Props = keysOf<ProgressReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressReport>>();

  readonly type: ReportType.Progress;

  @Field()
  readonly varianceReasons: SecuredProgressVarianceReasons;

  @Field()
  readonly varianceExplanation: SecuredStringNullable;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('Secured Periodic Report'),
})
export class SecuredPeriodicReport extends SecuredProperty(PeriodicReport) {}
