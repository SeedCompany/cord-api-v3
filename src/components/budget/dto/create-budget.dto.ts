import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Budget, BudgetStatus } from '../budget';

@InputType()
export abstract class CreateBudget {
  @Field({ nullable: true })
  @MinLength(2)
  readonly status: BudgetStatus;

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
  @Field()
  readonly budget: Budget;
}
