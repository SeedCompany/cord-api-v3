import { Field, InputType, ObjectType } from 'type-graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Organization } from './organization';

@InputType()
export class OrganizationListInput extends SortablePaginationInput {
  static defaultVal = new OrganizationListInput();

  @Field({
    description: 'Filter to matching names',
    nullable: true,
  })
  readonly name?: string;

  readonly sort: keyof Organization = 'name';
}

@ObjectType()
export class OrganizationListOutput extends PaginatedList(Organization) {}
