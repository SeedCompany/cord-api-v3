import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Organization } from './organization.dto';

@InputType()
export abstract class OrganizationFilters {
  readonly userId?: ID;
}

@InputType()
export class OrganizationListInput extends SortablePaginationInput<
  keyof Organization
>({
  defaultSort: 'name',
}) {
  @FilterField(() => OrganizationFilters, { internal: true })
  readonly filter: OrganizationFilters;
}

@ObjectType()
export class OrganizationListOutput extends PaginatedList(Organization) {}

@ObjectType({
  description: SecuredList.descriptionFor('organizations'),
})
export abstract class SecuredOrganizationList extends SecuredList(
  Organization,
) {}
