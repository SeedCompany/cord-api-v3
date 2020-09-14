import { registerEnumType } from '@nestjs/graphql';

export enum FinancialReportingType {
  Funded = 'Funded',
  FieldEngaged = 'FieldEngaged',
}

registerEnumType(FinancialReportingType, { name: 'FinancialReportingType' });
