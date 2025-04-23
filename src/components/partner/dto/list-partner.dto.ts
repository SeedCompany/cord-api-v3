import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateFilter,
  FilterField,
  ID,
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

  @Field({
    description:
      'Only partners that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;

  @Field({
    nullable: true,
  })
  readonly globalInnovationsClient?: boolean;

  @FilterField(() => OrganizationFilters)
  readonly organization?: OrganizationFilters & {};

  @Field(() => [PartnerType], {
    nullable: true,
  })
  readonly types?: PartnerType[];

  @Field(() => [FinancialReportingType], {
    nullable: true,
  })
  readonly financialReportingTypes?: FinancialReportingType[];

  @Field({
    nullable: true,
  })
  @Type(() => DateFilter)
  @ValidateNested()
  readonly startDate?: DateFilter;
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
