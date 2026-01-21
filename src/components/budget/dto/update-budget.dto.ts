import { Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersion } from '../../file/dto';
import { BudgetRecord } from './budget-record.dto';
import { type BudgetStatus } from './budget-status.enum';
import { Budget } from './budget.dto';

@InputType()
export abstract class UpdateBudget {
  @IdField()
  readonly id: ID;

  readonly status?: BudgetStatus | undefined;

  @Field({
    description: 'New version of the universal budget template',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly universalTemplateFile?: CreateDefinedFileVersion;
}

@ObjectType()
export abstract class BudgetUpdated {
  @Field()
  readonly budget: Budget;
}

@InputType()
export abstract class UpdateBudgetRecord {
  @IdField()
  readonly id: ID;

  @Field(() => Float, { nullable: true })
  readonly amount: number | null;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class BudgetRecordUpdated {
  @Field()
  readonly budgetRecord: BudgetRecord;
}
