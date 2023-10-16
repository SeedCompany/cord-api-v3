import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum, SecuredProperty } from '~/common';

export type ReportPeriod = EnumType<typeof ReportPeriod>;
export const ReportPeriod = makeEnum({
  name: 'PeriodType',
  values: ['Monthly', 'Quarterly'],
});

@ObjectType({
  description: SecuredProperty.descriptionFor('report period'),
})
export abstract class SecuredReportPeriod extends SecuredEnum(ReportPeriod, {
  nullable: true,
}) {}
