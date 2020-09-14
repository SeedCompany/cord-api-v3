import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Partner } from './partner';

@InputType()
export abstract class PartnerFilters {
  @Field({ nullable: true })
  readonly organizationId?: string;
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
