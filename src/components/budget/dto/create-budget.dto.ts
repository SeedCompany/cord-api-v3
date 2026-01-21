import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { CreateDefinedFileVersion } from '../../file/dto';

@InputType()
export abstract class CreateBudget {
  @IdField()
  readonly project: ID<'Project'>;

  @Field({
    description: 'Initial version of the universal budget template',
    nullable: true,
  })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly universalTemplateFile?: CreateDefinedFileVersion;
}

export abstract class CreateBudgetRecord {
  readonly budget: ID<'Budget'>;

  readonly organization: ID<'Organization'>;

  readonly fiscalYear: number;
}
