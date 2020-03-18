import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, Int, ObjectType } from 'type-graphql';
import { SecuredInt } from '../../../common';
import { Budget, BudgetRecord, SecuredBudgetStatus } from './budget';

@InputType()
export abstract class UpdateBudget {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly status: SecuredBudgetStatus;
}

@InputType()
export abstract class UpdateBudgetInput {
  @Field()
  @Type(() => UpdateBudget)
  @ValidateNested()
  readonly budget: UpdateBudget;
}

@ObjectType()
export abstract class UpdateBudgetOutput {
  @Field()
  readonly budget: Budget;
}

@InputType()
export abstract class UpdateBudgetRecord {
  @Field(() => ID)
  readonly id: string;

  @Field(() => Int, { nullable: true })
  readonly fiscalYear?: SecuredInt;

  @Field(() => Int, { nullable: true })
  readonly amount?: SecuredInt;
}

@InputType()
export abstract class UpdateBudgetRecordInput {
  @Field()
  @Type(() => UpdateBudgetRecord)
  @ValidateNested()
  readonly budgetRecord: UpdateBudgetRecord;
}

@ObjectType()
export abstract class UpdateBudgetRecordOutput {
  @Field()
  readonly budgetRecord: BudgetRecord;
}
