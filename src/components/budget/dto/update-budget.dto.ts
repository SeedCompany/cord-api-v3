import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, Int, ObjectType } from 'type-graphql';
import { Budget, BudgetRecord, BudgetStatus } from '.';

@InputType()
export abstract class UpdateBudget {
  @Field(() => ID)
  readonly id: string;

  @Field()
  readonly status?: BudgetStatus;
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
  readonly fiscalYear?: number;

  @Field(() => Int, { nullable: true })
  readonly amount?: number;
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
