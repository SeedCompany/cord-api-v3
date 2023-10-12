import { EnumType, makeEnum } from '~/common';

export type FinancialReportingType = EnumType<typeof FinancialReportingType>;
export const FinancialReportingType = makeEnum({
  name: 'FinancialReportingType',
  values: ['Funded', 'FieldEngaged', 'Hybrid'],
});
