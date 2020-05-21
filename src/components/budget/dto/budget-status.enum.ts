import { registerEnumType } from '@nestjs/graphql';

export enum BudgetStatus {
  Pending = 'Pending',
  Current = 'Current',
  Superceded = 'Superceded',
  Rejected = 'Rejected',
}

registerEnumType(BudgetStatus, { name: 'BudgetStatus' });
