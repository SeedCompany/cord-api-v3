import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  PaginatedList,
  SecuredList,
  SecuredPropertyList,
  SortablePaginationInput,
} from '~/common';
import { AllianceMembership } from './alliance-membership.dto';

@InputType()
export abstract class AllianceMembershipFilters {
  readonly allianceId?: ID;
  readonly memberId?: ID;
}

@InputType()
export class AllianceMembershipListInput extends SortablePaginationInput<
  keyof AllianceMembership
>({
  defaultSort: 'joinedAt',
}) {
  @FilterField(() => AllianceMembershipFilters, { internal: true })
  readonly filter?: AllianceMembershipFilters;
}

@ObjectType()
export class AllianceMembershipListOutput extends PaginatedList(
  AllianceMembership,
) {}

@ObjectType({
  description: SecuredList.descriptionFor('alliance memberships'),
})
export class SecuredAllianceMembershipList extends SecuredList(
  AllianceMembership,
) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('alliance memberships'),
})
export class SecuredAllianceMemberships extends SecuredPropertyList(
  AllianceMembership,
) {}
