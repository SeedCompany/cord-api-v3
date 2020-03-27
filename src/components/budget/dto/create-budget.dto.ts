import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Budget, BudgetRecord } from '.';

@InputType()
export abstract class CreateBudget {
  @Field(() => ID)
  @MinLength(2)
  readonly projectId: string;
}

@InputType()
export abstract class CreateBudgetInput {
  @Field()
  @Type(() => CreateBudget)
  @ValidateNested()
  readonly budget: CreateBudget;
}

@ObjectType()
export abstract class CreateBudgetOutput {
  @Field(() => Budget)
  readonly budget: Budget;
}
@InputType()
export abstract class CreateBudgetRecord {
  @Field(() => ID)
  @MinLength(2)
  readonly budgetId: string;

  @Field(() => ID)
  @MinLength(2)
  readonly organizationId: string;

  @Field()
  readonly fiscalYear: number;
}

@InputType()
export abstract class CreateBudgetRecordInput {
  @Field()
  @Type(() => CreateBudgetRecord)
  @ValidateNested()
  readonly budgetRecord: CreateBudgetRecord;
}

@ObjectType()
export abstract class CreateBudgetRecordOutput {
  @Field(() => BudgetRecord)
  readonly budgetRecord: BudgetRecord;
}
