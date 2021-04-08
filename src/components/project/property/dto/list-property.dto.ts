import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Role } from '../../../authorization';
import { Property } from './property.dto';

@InputType()
export abstract class PropertyFilters {
  @Field(() => [Role], {
    description: 'Only members with these roles',
    nullable: true,
  })
  readonly roles?: Role[];

  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class PropertyListInput extends SortablePaginationInput<keyof Property>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PropertyListInput();

  @Field({ nullable: true })
  @Type(() => PropertyFilters)
  @ValidateNested()
  readonly filter: PropertyFilters = defaultFilters;
}

@ObjectType()
export class PropertyListOutput extends PaginatedList(Property) {}

@ObjectType({
  description: SecuredList.descriptionFor('property objects'),
})
export abstract class SecuredPropertyList extends SecuredList(Property) {}
