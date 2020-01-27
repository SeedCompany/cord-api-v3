import { Field, InputType, ObjectType } from 'type-graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Organization } from './organization';

@InputType()
export class OrganizationListInput extends SortablePaginationInput<keyof Organization>({
  defaultSort: 'name',
}) {
  static defaultVal = new OrganizationListInput();

  @Field({
    description: 'Filter to matching names',
    nullable: true,
  })
  readonly name?: string;
}

@ObjectType()
export class OrganizationListOutput extends PaginatedList(Organization) {}
