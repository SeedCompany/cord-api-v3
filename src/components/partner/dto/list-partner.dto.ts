import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateFilter,
  DateTimeFilter,
  FilterField,
  type ID,
  ListField,
  OptionalField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { OrganizationFilters } from '../../organization/dto';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type.enum';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class PartnerFilters {
  readonly userId?: ID;

  @OptionalField({
    description:
      'Only partners that are pinned/unpinned by the requesting user',
  })
  readonly pinned?: boolean;

  @OptionalField()
  readonly globalInnovationsClient?: boolean;

  @FilterField(() => OrganizationFilters)
  readonly organization?: OrganizationFilters & {};

  @ListField(() => PartnerType, {
    optional: true,
    empty: 'omit',
  })
  readonly types?: readonly PartnerType[];

  @ListField(() => FinancialReportingType, {
    optional: true,
    empty: 'omit',
  })
  readonly financialReportingTypes?: readonly FinancialReportingType[];

  @OptionalField()
  @Type(() => DateFilter)
  @ValidateNested()
  readonly startDate?: DateFilter;

  @OptionalField()
  @Type(() => DateTimeFilter)
  @ValidateNested()
  readonly createdAt?: DateTimeFilter;
}

@InputType()
export class PartnerListInput extends SortablePaginationInput<keyof Partner>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => PartnerFilters)
  readonly filter?: PartnerFilters;
}

@ObjectType()
export class PartnerListOutput extends PaginatedList(Partner) {}

@ObjectType({
  description: SecuredList.descriptionFor('partners'),
})
export abstract class SecuredPartnerList extends SecuredList(Partner) {}
