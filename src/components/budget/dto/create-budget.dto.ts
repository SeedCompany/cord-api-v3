import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '~/common';
import { CreateDefinedFileVersionInput } from '../../file/dto';

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

export abstract class CreateBudgetRecord {
  readonly budgetId: ID;

  readonly organizationId: ID;

  readonly fiscalYear: number;
}
