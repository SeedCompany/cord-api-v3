import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Budget, BudgetRecord, BudgetStatus } from '.';
import { IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file/dto';

@InputType()
export abstract class UpdateBudget {
  @IdField()
  readonly id: string;

  readonly status?: BudgetStatus | undefined;

  @Field({
    description: 'New version of the universal budget template',
    nullable: true,
  })
  readonly universalTemplateFile?: CreateDefinedFileVersionInput;
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
  @IdField()
  readonly id: string;

  @Field(() => Float, { nullable: true })
  readonly amount: number | null;
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
