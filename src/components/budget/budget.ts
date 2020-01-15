import { Organization } from '../organization/organization';
import { registerEnumType, ObjectType } from 'type-graphql';

@ObjectType()
export class Budget {}
export interface Budget {
  id: string;
  status: BudgetStatus;
  budgetDetails: BudgetDetails[];
}

export enum BudgetStatus {
  Pending = 'pending',
  Current = 'current',
  Superceded = 'superceded',
  Rejected = 'rejected',
}

export interface BudgetDetails {
  organization: Organization;
  fiscalYear: number;
  amount: number;
}

registerEnumType(BudgetStatus, {name: 'BudgetStatus'});