import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Organization } from './organization.dto';

@InputType()
export abstract class OrganizationFilters {
  readonly userId?: ID;
}

const defaultFilters = {};

@InputType()
export class OrganizationListInput extends SortablePaginationInput<
  keyof Organization
>({
  defaultSort: 'name',
}) {
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
