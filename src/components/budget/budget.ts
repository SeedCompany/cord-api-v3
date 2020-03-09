import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from 'type-graphql';
import { Organization } from '../organization';

export enum BudgetStatus {
  Pending = 'pending',
  Current = 'current',
  Superceded = 'superceded',
  Rejected = 'rejected',
}

registerEnumType(BudgetStatus, { name: 'BudgetStatus' });

@ObjectType()
@InputType('BudgetInput')
export class Budget {
  @Field(() => ID)
  id: string;

  @Field(() => BudgetStatus, { nullable: true })
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

export interface Budget {
  id: string;
  status: BudgetStatus;
  budgetDetails: BudgetDetails[];
}

@ObjectType()
@InputType('BudgetDetailsInput')
export class BudgetDetails {
  organization: Organization;

  @Field({ nullable: true })
  fiscalYear: number;

  @Field({ nullable: true })
  amount: number;
}
export interface BudgetDetails {
  organization: Organization;
  fiscalYear: number;
  amount: number;
}
