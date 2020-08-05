import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class PartnershipFilters {
  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class PartnershipListInput extends SortablePaginationInput<
  keyof Partnership
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PartnershipListInput();

  @Type(() => PartnershipFilters)
  @ValidateNested()
  readonly filter: PartnershipFilters = defaultFilters;
}

@ObjectType()
export class PartnershipListOutput extends PaginatedList(Partnership) {}

@ObjectType({
  description: SecuredList.descriptionFor('partnership objects'),
})
export abstract class SecuredPartnershipList extends SecuredList(Partnership) {}
