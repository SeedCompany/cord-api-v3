import { MergeExclusive } from 'type-fest';
import { ServerException, simpleSwitch } from '../../../common';
import { NarrativeReport } from '../../narrative-report/dto';
import { FinancialReport, ProgressReport } from './periodic-report.dto';
import { ReportType } from './report-type.enum';

export type PeriodicReport = MergeExclusive<
  MergeExclusive<FinancialReport, NarrativeReport>,
  ProgressReport
>;

export const resolveReportType = (report: { type: ReportType }) => {
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
