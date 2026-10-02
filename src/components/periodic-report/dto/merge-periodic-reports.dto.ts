import { simpleSwitch } from '@seedcompany/common';
import { type MergeExclusive } from 'type-fest';
import { ServerException } from '~/common';
import { GTLReport } from '../../gtl-report/dto';
import { ProgressReport } from '../../progress-report/dto';
import { FinancialReport, NarrativeReport } from './periodic-report.dto';

export type PeriodicReport = MergeExclusive<
  MergeExclusive<
    MergeExclusive<FinancialReport, NarrativeReport>,
    ProgressReport
  >,
  GTLReport
>;

const getPeriodicReportTypeMap = () => ({
  Financial: FinancialReport,
  Narrative: NarrativeReport,
  Progress: ProgressReport,
  GTL: GTLReport,
});
type PeriodicReportTypeMapStatic = ReturnType<typeof getPeriodicReportTypeMap>;
export type PeriodicReportTypeMap = {
  [K in keyof PeriodicReportTypeMapStatic]: PeriodicReportTypeMapStatic[K]['prototype'];
};

export const resolveReportType = (report: Pick<PeriodicReport, 'type'>) => {
  const type = simpleSwitch(report.type, getPeriodicReportTypeMap());
  if (!type) {
    throw new ServerException('Could not resolve periodic report type');
  }
  return type;
};
