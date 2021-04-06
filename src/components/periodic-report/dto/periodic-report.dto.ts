import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  CalendarDate,
  ID,
  Resource,
  Secured,
  SecuredProps,
} from '../../../common';
import { ReportType } from './report-type.enum';

type AnyPeriodicReport = MergeExclusive<
  MergeExclusive<FinancialReport, NarrativeReport>,
  ProgressReport
>;

@InterfaceType({
  resolveType: (val: PeriodicReport) => {
    if (val.type === ReportType.Financial) {
      return FinancialReport;
    }
    if (val.type === ReportType.Narrative) {
      return NarrativeReport;
    }
    if (val.type === ReportType.Progress) {
      return FinancialReport;
    }

    throw new Error('Could not resolve periodic report type');
  },
})
class PeriodicReport extends Resource {
  static readonly Props = keysOf<PeriodicReport>();
  static readonly SecuredProps = keysOf<SecuredProps<PeriodicReport>>();

  @Field(() => ReportType)
  readonly type: ReportType;

  @Field(() => CalendarDate)
  readonly start: CalendarDate;

  @Field(() => CalendarDate)
  readonly end: CalendarDate;

  readonly reportFile: Secured<ID>;
}

export {
  PeriodicReport as IPeriodicReport,
  AnyPeriodicReport as PeriodicReport,
};

@ObjectType({
  implements: [PeriodicReport, Resource],
})
export class FinancialReport extends PeriodicReport {
  static readonly Props = keysOf<FinancialReport>();
  static readonly SecuredProps = keysOf<SecuredProps<FinancialReport>>();

  readonly type: ReportType.Financial;
}

@ObjectType({
  implements: [PeriodicReport, Resource],
})
export class NarrativeReport extends PeriodicReport {
  static readonly Props = keysOf<NarrativeReport>();
  static readonly SecuredProps = keysOf<SecuredProps<NarrativeReport>>();

  readonly type: ReportType.Narrative;
}

@ObjectType({
  implements: [PeriodicReport, Resource],
})
export class ProgressReport extends PeriodicReport {
  static readonly Props = keysOf<ProgressReport>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressReport>>();

  readonly type: ReportType.Progress;
}
