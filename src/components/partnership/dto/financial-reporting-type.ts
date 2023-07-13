import { registerEnumType } from '@nestjs/graphql';

export enum FinancialReportingType {
  Funded = 'Funded',
  FieldEngaged = 'FieldEngaged',
  Hybrid = 'Hybrid',
}

registerEnumType(FinancialReportingType, { name: 'FinancialReportingType' });
