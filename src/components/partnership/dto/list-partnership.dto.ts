import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class PartnershipFilters {
  readonly projectId?: ID;
}

@InputType()
export class PartnershipListInput extends SortablePaginationInput<
  keyof Partnership
>({
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
