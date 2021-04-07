import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { Budget } from './budget.dto';

@InputType()
export abstract class CreateBudget {
  @IdField()
  readonly projectId: ID;

  @Field({
    description: 'Initial version of the universal budget template',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly universalTemplateFile?: CreateDefinedFileVersionInput;
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

export abstract class CreateBudgetRecord {
  @MinLength(2)
  readonly budgetId: ID;

  @MinLength(2)
  readonly organizationId: ID;

  readonly fiscalYear: number;
}
