import { Field, ObjectType } from '@nestjs/graphql';
import { ID, IdField, SecuredProperty } from '~/common';
import { ProjectType as Program } from '../../../project/dto/project-type.enum';
import { FinanceDepartmentIdBlockInput } from './id-blocks.input';

@ObjectType()
export class FinanceDepartmentIdBlock extends FinanceDepartmentIdBlockInput {
  @IdField()
  readonly id: ID;

  @Field(() => [Program])
  declare readonly programs: readonly Program[];
}

@ObjectType()
export class SecuredFinanceDepartmentIdBlock extends SecuredProperty(
  FinanceDepartmentIdBlock,
) {}
@ObjectType()
export class SecuredFinanceDepartmentIdBlockNullable extends SecuredProperty(
  FinanceDepartmentIdBlock,
  { nullable: true },
) {}
