import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Budget, BudgetRecord, BudgetStatus } from '.';
import { ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file/dto';

@InputType()
export abstract class UpdateBudget {
  @IdField()
  readonly id: ID;

  readonly status?: BudgetStatus | undefined;

  @Field({
    description: 'New version of the universal budget template',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
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
  readonly id: ID;

  @Field(() => Float, { nullable: true })
  readonly amount: number | null;
}

@InputType()
export abstract class UpdateBudgetRecordInput {
  @Field()
  @Type(() => UpdateBudgetRecord)
  @ValidateNested()
  readonly budgetRecord: UpdateBudgetRecord;

  @IdField({
    description: 'The change object to associate these engagement changes with',
    nullable: true,
  })
  readonly changeset?: ID;
}

@ObjectType()
export abstract class UpdateBudgetRecordOutput {
  @Field()
  readonly budgetRecord: BudgetRecord;
}
