import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '~/common';
import { ProjectType } from '../../dto';
import { ProjectTypeFinancialApprover } from './project-type-financial-approver.dto';

@InputType()
export abstract class SetProjectTypeFinancialApprover {
  @IdField()
  readonly user: ID;

  @Field(() => [ProjectType])
  readonly projectTypes: readonly ProjectType[];
}

@InputType()
export abstract class SetProjectTypeFinancialApproverInput {
  @Field()
  @Type(() => SetProjectTypeFinancialApprover)
  @ValidateNested()
  readonly financialApprover: SetProjectTypeFinancialApprover;
}

@ObjectType()
export abstract class SetProjectTypeFinancialApproverOutput {
  @Field()
  readonly financialApprover: ProjectTypeFinancialApprover;
}
