import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class PartnershipFilters {
  @Field(() => PartnershipAgreementStatus, {
    description: 'Only partnerships matching this agreement status',
    nullable: true,
  })
  readonly agreementStatus?: PartnershipAgreementStatus;
}

const defaultFilters = {};

@InputType()
export class PartnershipListInput extends SortablePaginationInput<
  keyof Partnership
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PartnershipListInput();

  @Field({ nullable: true })
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
