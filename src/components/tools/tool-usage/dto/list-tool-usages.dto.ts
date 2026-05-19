import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  type EnumType,
  FilterField,
  makeEnum,
  OptionalField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ToolFilters } from '../../tool/dto';
import { ToolUsage } from './tool-usage.dto';

export type ToolContainerType = EnumType<typeof ToolContainerType>;
export const ToolContainerType = makeEnum({
  name: 'ToolContainerType',
  values: ['Engagement', 'Project'],
});

@ObjectType()
export class ToolContainerSummary {
  @Field(() => ToolContainerType)
  readonly containerType: ToolContainerType;

  @Field(() => Int)
  readonly total: number;
}

@InputType()
export abstract class ToolUsageFilters {
  @FilterField(() => ToolFilters)
  readonly tool?: ToolFilters & {};

  @OptionalField(() => ToolContainerType)
  readonly containerType?: ToolContainerType;
}

@InputType()
export class ToolUsageListInput extends SortablePaginationInput<
  keyof ToolUsage
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => ToolUsageFilters)
  readonly filter?: ToolUsageFilters;
}

@ObjectType()
export class ToolUsageListOutput extends PaginatedList(ToolUsage) {}

@ObjectType({
  description: SecuredList.descriptionFor('tool usages'),
})
export abstract class SecuredToolUsageList extends SecuredList(ToolUsage) {}
