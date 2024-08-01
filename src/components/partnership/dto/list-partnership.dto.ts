import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { uniq } from 'lodash';
import {
  FilterField,
  ID,
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

  @Field(() => [PartnerType], { nullable: true })
  @Transform(({ value }) => {
    const types = uniq(value);
    return types.length > 0 && types.length < PartnerType.values.size
      ? types
      : undefined;
  })
  readonly types?: readonly PartnerType[];
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
