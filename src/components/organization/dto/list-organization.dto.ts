import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  IdField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Organization } from './organization';

@InputType()
export abstract class OrganizationFilters {
  @Field({
    description: 'Only organizations matching this name',
    nullable: true,
  })
  readonly name?: string;

  @IdField({
    description: 'User IDs ANY of which must belong to the organizations',
    nullable: true,
  })
  readonly userId?: string;
}

const defaultFilters = {};

@InputType()
export class OrganizationListInput extends SortablePaginationInput<
  keyof Organization
>({
  defaultSort: 'name',
}) {
  static defaultVal = new OrganizationListInput();

  @Field({ nullable: true })
  @Type(() => OrganizationFilters)
  @ValidateNested()
  readonly filter: OrganizationFilters = defaultFilters;
}

@ObjectType()
export class OrganizationListOutput extends PaginatedList(Organization) {}

@ObjectType({
  description: SecuredList.descriptionFor('organizations'),
})
export abstract class SecuredOrganizationList extends SecuredList(
  Organization
) {}
