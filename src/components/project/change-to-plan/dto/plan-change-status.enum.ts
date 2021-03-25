import { registerEnumType } from '@nestjs/graphql';

export enum PlanChangeStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

registerEnumType(PlanChangeStatus, {
  name: 'PlanChangeStatus',
});
