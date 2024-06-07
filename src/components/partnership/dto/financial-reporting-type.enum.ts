import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum, SecuredEnumList } from '~/common';

export type FinancialReportingType = EnumType<typeof FinancialReportingType>;
export const FinancialReportingType = makeEnum({
  name: 'FinancialReportingType',
  values: ['Funded', 'FieldEngaged', 'Hybrid'],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('financial reporting types'),
})
export abstract class SecuredFinancialReportingTypes extends SecuredEnumList(
  FinancialReportingType,
) {}

@ObjectType({
  description: SecuredEnum.descriptionFor('financial reporting type'),
})
export abstract class SecuredFinancialReportingType extends SecuredEnum(
  FinancialReportingType,
  { nullable: true },
) {}
