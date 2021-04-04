import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Role } from '../../../authorization';
import { PlanChange } from './plan-change.dto';

@InputType()
export abstract class PlanChangeFilters {
  @Field(() => [Role], {
    description: 'Only members with these roles',
    nullable: true,
  })
  readonly roles?: Role[];

  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class PlanChangeListInput extends SortablePaginationInput<
  keyof PlanChange
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PlanChangeListInput();

  @Field({ nullable: true })
  @Type(() => PlanChangeFilters)
  @ValidateNested()
  readonly filter: PlanChangeFilters = defaultFilters;
}

@ObjectType()
export class PlanChangeListOutput extends PaginatedList(PlanChange) {}

@ObjectType({
  description: SecuredList.descriptionFor('planchange objects'),
})
export abstract class SecuredPlanChangeList extends SecuredList(PlanChange) {}
