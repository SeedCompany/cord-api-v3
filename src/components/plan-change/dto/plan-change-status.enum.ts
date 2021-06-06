import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum PlanChangeStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

registerEnumType(PlanChangeStatus, {
  name: 'PlanChangeStatus',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a plan change status'),
})
export abstract class SecuredPlanChangeStatus extends SecuredEnum(
  PlanChangeStatus
) {}
