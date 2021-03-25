import { registerEnumType } from '@nestjs/graphql';

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
