import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  ListField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { PartnerFilters, PartnerType } from '../../partner/dto';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class PartnershipFilters {
  readonly projectId?: ID;

  @FilterField(() => PartnerFilters)
  readonly partner?: PartnerFilters & {};

  @ListField(() => PartnerType, {
    optional: true,
    empty: 'omit',
    transform: (value) =>
      // If given all options, there is no need to filter
      !value || value.length === PartnerType.values.size ? undefined : value,
  })
  readonly types?: readonly PartnerType[];
}

@InputType()
export class PartnershipListInput extends SortablePaginationInput<keyof Partnership>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => PartnershipFilters, { internal: true })
  readonly filter?: PartnershipFilters;
}

@ObjectType()
export class PartnershipListOutput extends PaginatedList(Partnership) {}

@ObjectType({
  description: SecuredList.descriptionFor('partnership objects'),
})
export abstract class SecuredPartnershipList extends SecuredList(Partnership) {}
