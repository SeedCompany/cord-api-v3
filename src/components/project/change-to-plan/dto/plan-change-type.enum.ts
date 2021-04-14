import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../../common';

export enum PlanChangeType {
  Time = 'Time',
  Budget = 'Budget',
  Goal = 'Goal',
  Language = 'Language',
  Other = 'Other',
}

registerEnumType(PlanChangeType, {
  name: 'PlanChangeType',
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('plan change types'),
})
export abstract class SecuredPlanChangeTypes extends SecuredEnumList(
  PlanChangeType
) {}
