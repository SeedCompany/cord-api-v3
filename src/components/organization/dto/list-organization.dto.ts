import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { PaginatedList, SecuredList, SortablePaginationInput } from '../../../common';
import { Organization } from './organization';

@InputType()
export abstract class OrganizationFilters {
  @Field({
    description: 'Only organizations matching this name',
    nullable: true,
  })
  readonly name?: string;

  @Field(() => [ID], {
    description: 'User IDs ANY of which must belong to the organizations',
    nullable: true,
  })
  readonly userIds?: string[];
}

@InputType()
export class OrganizationListInput extends SortablePaginationInput<keyof Organization>({
  defaultSort: 'name',
}) {
  static defaultVal = new OrganizationListInput();

  @Field({ nullable: true })
  @Type(() => OrganizationFilters)
  @ValidateNested()
  readonly filter: OrganizationFilters = {};
}

@ObjectType()
export class OrganizationListOutput extends PaginatedList(Organization) {}

@ObjectType({
  description: SecuredList.descriptionFor('organizations'),
})
export abstract class SecuredOrganizationList extends SecuredList(
  Organization,
) {}
