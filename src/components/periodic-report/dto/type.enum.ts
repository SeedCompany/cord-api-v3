import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum, SecuredProperty } from '../../../common';

export enum ReportType {
  Financial = 'Financial',
  Progress = 'Progress',
  Narrative = 'Narrative',
}

export enum ReportPeriod {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
}

registerEnumType(ReportType, { name: 'ReportType' });
registerEnumType(ReportPeriod, { name: 'PeriodType' });

@ObjectType({
  description: SecuredProperty.descriptionFor('report period'),
})
export abstract class SecuredReportPeriod extends SecuredEnum(ReportPeriod) {}
