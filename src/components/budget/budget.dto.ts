import { ObjectType, Field, InputType } from 'type-graphql';
import { BudgetDetails, BudgetStatus } from './budget';

// CREATE
@InputType()
export class CreateBudgetInput {
  @Field(type => BudgetStatus)
  status: BudgetStatus;
  @Field(type => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

@InputType()
export class CreateBudgetInputDto {
  @Field()
  budget: CreateBudgetInput;
}

@ObjectType()
export class CreateBudgetOutput {
  @Field(type => String)
  id: string;
  @Field(type => BudgetStatus)
  status: BudgetStatus;
  @Field(type => [BudgetDetails], { nullable: true })
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
  @Field(type => String)
  id: string;
}

@InputType()
export class ReadBudgetInputDto {
  @Field()
  budget: ReadBudgetInput;
}
@ObjectType()
export class ReadBudgetOutput {
  @Field(type => String)
  id: string;
  @Field(type => BudgetStatus)
  status: BudgetStatus;
  @Field(type => [BudgetDetails], { nullable: true })
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
  @Field(type => String)
  id: string;

  @Field(type => BudgetStatus)
  status: BudgetStatus;
  @Field(type => [BudgetDetails], { nullable: true })
  budgetDetails: BudgetDetails[];
}

@InputType()
export class UpdateBudgetInputDto {
  @Field()
  budget: UpdateBudgetInput;
}

@ObjectType()
export class UpdateBudgetOutput {
  @Field(type => String)
  id: string;
  @Field(type => BudgetStatus)
  status: BudgetStatus;
  @Field(type => [BudgetDetails], { nullable: true })
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
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteBudgetInputDto {
  @Field()
  budget: DeleteBudgetInput;
}

@ObjectType()
export class DeleteBudgetOutput {
  @Field(type => String)
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
