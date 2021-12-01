import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Partner } from './partner.dto';

@InputType()
export abstract class PartnerFilters {
  readonly organizationId?: ID;
  readonly userId?: ID;

  @Field({
    description:
      'Only partners that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;
}

const defaultFilters = {};

@InputType()
export class PartnerListInput extends SortablePaginationInput<keyof Partner>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PartnerListInput();

  @Field({ nullable: true })
  @Type(() => PartnerFilters)
  @ValidateNested()
  readonly filter: PartnerFilters = defaultFilters;
}

@ObjectType()
export class PartnerListOutput extends PaginatedList(Partner) {}

@ObjectType({
  description: SecuredList.descriptionFor('partners'),
})
export abstract class SecuredPartnerList extends SecuredList(Partner) {}
