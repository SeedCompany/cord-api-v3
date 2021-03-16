import { registerEnumType } from '@nestjs/graphql';

export enum ReportType {
  FINANCIAL_REPORT = 'FINANCIAL_REPORT',
  PROGRESS_REPORT = 'PROGRESS_REPORT',
  NARRATIVE_REPORT = 'NARRATIVE_REPORT',
}

export enum PeriodType {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

registerEnumType(ReportType, { name: 'ReportType' });
registerEnumType(PeriodType, { name: 'PeriodType' });
