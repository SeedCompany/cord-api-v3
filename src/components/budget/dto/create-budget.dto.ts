import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import { Budget, BudgetStatus } from '../budget';

@InputType()
export abstract class CreateBudget {
  @Field({ nullable: true })
  @MinLength(2)
  readonly status: BudgetStatus;
}

@InputType()
export abstract class CreateBudgetInput {
  @Field()
  @Type(() => CreateBudget)
  @ValidateNested()
  readonly zone: CreateBudget;
}

@ObjectType()
export abstract class CreateBudgetOutput {
  @Field()
  readonly zone: Budget;
}
