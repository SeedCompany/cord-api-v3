import { Organization } from '../organization/organization';

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
