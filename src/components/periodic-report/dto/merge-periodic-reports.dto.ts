import { MergeExclusive } from 'type-fest';
import { ServerException, simpleSwitch } from '~/common';
import { ProgressReport } from '../../progress-report/dto';
import { FinancialReport, NarrativeReport } from './periodic-report.dto';

export type PeriodicReport = MergeExclusive<
  MergeExclusive<FinancialReport, NarrativeReport>,
  ProgressReport
>;

const getPeriodicReportTypeMap = () => ({
  Financial: FinancialReport,
  Narrative: NarrativeReport,
  Progress: ProgressReport,
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
