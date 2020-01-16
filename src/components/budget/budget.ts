import { Organization } from '../organization/organization';
import { registerEnumType, ObjectType, InputType, Field } from 'type-graphql';

@ObjectType()
@InputType('BudgetInput')
export class Budget {
  @Field()
  id: string;

  @Field(type => BudgetStatus, { nullable: true })
  status: BudgetStatus;

  @Field(type => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

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

@ObjectType()
@InputType('BudgetDetailsInput')
export class BudgetDetails {
  @Field(type => Organization, { nullable: true })
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

registerEnumType(BudgetStatus, { name: 'BudgetStatus' });
