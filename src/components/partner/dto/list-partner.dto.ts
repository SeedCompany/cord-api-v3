import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Partner } from './partner.dto';

@InputType()
export abstract class PartnerFilters {
  readonly userId?: ID;

  @Field({
    description:
      'Only partners that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;
}

@InputType()
export class PartnerListInput extends SortablePaginationInput<keyof Partner>({
  defaultSort: 'createdAt',
}) {
  @FilterField(PartnerFilters)
  readonly filter: PartnerFilters;
}

@ObjectType()
export class PartnerListOutput extends PaginatedList(Partner) {}

@ObjectType({
  description: SecuredList.descriptionFor('partners'),
})
export abstract class SecuredPartnerList extends SecuredList(Partner) {}
