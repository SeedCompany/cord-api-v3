import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';
import {
  type CalendarDate,
  DateField,
  type ID,
  IdField,
  IsId,
  ListField,
  NameField,
} from '~/common';
import { FinanceDepartmentIdBlockInput } from '../../finance/department/dto/id-blocks.input';
import { FinancialReportingType } from '../../partnership/dto';
import { ProjectType } from '../../project/dto/project-type.enum';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class UpdatePartner {
  @IdField()
  readonly id: ID;

  @IdField({ nullable: true })
  readonly pointOfContactId?: ID<'User'> | null;

  @ListField(() => PartnerType, { optional: true })
  readonly types?: readonly PartnerType[];

  @ListField(() => FinancialReportingType, { optional: true })
  readonly financialReportingTypes?: readonly FinancialReportingType[];

  @Field(() => String, { nullable: true })
  @Matches(/^[A-Z]{3}$/, {
    message: 'Must be 3 uppercase letters',
  })
  readonly pmcEntityCode?: string | null;

  @Field({ nullable: true })
  readonly globalInnovationsClient?: boolean;

  @Field({ nullable: true })
  readonly active?: boolean;

  @NameField({ nullable: true })
  readonly address?: string | null;

  @IdField({ nullable: true })
  readonly languageOfWiderCommunicationId?: ID<'Language'> | null;

  @IdField({ nullable: true })
  readonly parentId?: ID<'Partner'> | null;

  @ListField(() => IDType, { optional: true })
  @IsId({ each: true })
  readonly strategicAlliances?: ReadonlyArray<ID<'Partner'>>;

  @ListField(() => IDType, { optional: true })
  @IsId({ each: true })
  readonly countries?: ReadonlyArray<ID<'Location'>>;

  @ListField(() => IDType, { optional: true })
  @IsId({ each: true })
  readonly fieldRegions?: ReadonlyArray<ID<'FieldRegion'>>;

  @ListField(() => IDType, { optional: true })
  @IsId({ each: true })
  readonly languagesOfConsulting?: ReadonlyArray<ID<'Language'>>;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate | null;

  @ListField(() => ProjectType, { optional: true })
  readonly approvedPrograms?: readonly ProjectType[];

  @Field(() => FinanceDepartmentIdBlockInput, { nullable: true })
  @ValidateNested()
  @Type(() => FinanceDepartmentIdBlockInput)
  readonly departmentIdBlock?: FinanceDepartmentIdBlockInput | null;
}

@InputType()
export abstract class UpdatePartnerInput {
  @Field()
  @Type(() => UpdatePartner)
  @ValidateNested()
  readonly partner: UpdatePartner;
}

@ObjectType()
export abstract class UpdatePartnerOutput {
  @Field()
  readonly partner: Partner;
}
