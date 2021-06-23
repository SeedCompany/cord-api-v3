import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum, SecuredProperty } from '../../../common';

export enum ReportPeriod {
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
}

registerEnumType(ReportPeriod, { name: 'PeriodType' });

@ObjectType({
  description: SecuredProperty.descriptionFor('report period'),
})
export abstract class SecuredReportPeriod extends SecuredEnum(ReportPeriod, {
  nullable: true,
}) {}
