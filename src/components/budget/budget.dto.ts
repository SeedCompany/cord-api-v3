import { Field, InputType, ObjectType } from 'type-graphql';
import { BudgetDetails, BudgetStatus } from './budget';

// CREATE
@InputType()
export class CreateBudgetInput {
  @Field(() => BudgetStatus)
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

@InputType()
export class CreateBudgetInputDto {
  @Field()
  budget: CreateBudgetInput;
}

@ObjectType()
export class CreateBudgetOutput {
  @Field(() => String)
  id: string;
  @Field(() => BudgetStatus)
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}
@ObjectType()
export class CreateBudgetOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  budget: CreateBudgetOutput;

  constructor() {
    this.budget = new CreateBudgetOutput();
  }
}
// READ

@InputType()
export class ReadBudgetInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class ReadBudgetInputDto {
  @Field()
  budget: ReadBudgetInput;
}
@ObjectType()
export class ReadBudgetOutput {
  @Field(() => String)
  id: string;
  @Field(() => BudgetStatus)
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}
@ObjectType()
export class ReadBudgetOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  budget: ReadBudgetOutput;

  constructor() {
    this.budget = new ReadBudgetOutput();
  }
}

// UPDATE

@InputType()
export class UpdateBudgetInput {
  @Field(() => String)
  id: string;

  @Field(() => BudgetStatus)
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

@InputType()
export class UpdateBudgetInputDto {
  @Field()
  budget: UpdateBudgetInput;
}

@ObjectType()
export class UpdateBudgetOutput {
  @Field(() => String)
  id: string;
  @Field(() => BudgetStatus)
  status: BudgetStatus;
  @Field(() => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

@ObjectType()
export class UpdateBudgetOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  budget: UpdateBudgetOutput;

  constructor() {
    this.budget = new UpdateBudgetOutput();
  }
}

// DELETE

@InputType()
export class DeleteBudgetInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class DeleteBudgetInputDto {
  @Field()
  budget: DeleteBudgetInput;
}

@ObjectType()
export class DeleteBudgetOutput {
  @Field(() => String)
  id: string;
}

@ObjectType()
export class DeleteBudgetOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  budget: DeleteBudgetOutput;

  constructor() {
    this.budget = new DeleteBudgetOutput();
  }
}
