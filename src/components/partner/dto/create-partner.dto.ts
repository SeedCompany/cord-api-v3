import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import {
  CalendarDate,
  DateField,
  ID,
  IdField,
  IsId,
  NameField,
} from '~/common';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type.enum';
import { ProjectType } from '../../project/dto';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class CreatePartner {
  @IdField()
  readonly organizationId: ID;

  @IdField({ nullable: true })
  readonly pointOfContactId?: ID;

  @Field(() => [PartnerType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly types?: PartnerType[] = [];

  @Field(() => [FinancialReportingType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly financialReportingTypes?: FinancialReportingType[] = [];

  @Field({ nullable: true })
  @Matches(/^[A-Z]{3}$/, {
    message: 'Must be 3 uppercase letters',
  })
  readonly pmcEntityCode?: string;

  @Field({ nullable: true })
  readonly globalInnovationsClient?: boolean;

  @Field({ nullable: true })
  readonly active?: boolean;

  @NameField({ nullable: true })
  readonly address?: string;

  @IdField({ nullable: true })
  readonly languageOfWiderCommunicationId?: ID<'Language'> | null;

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => uniq(value))
  readonly countries?: ReadonlyArray<ID<'Location'>> = [];

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => uniq(value))
  readonly fieldRegions?: ReadonlyArray<ID<'FieldRegion'>> = [];

  @Field(() => [IDType], { name: 'languagesOfConsulting', nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly languagesOfConsulting?: ReadonlyArray<ID<'Language'>> = [];

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate;

  @Field(() => [ProjectType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly approvedPrograms?: ProjectType[];
}

@InputType()
export abstract class CreatePartnerInput {
  @Field()
  @Type(() => CreatePartner)
  @ValidateNested()
  readonly partner: CreatePartner;
}

@ObjectType()
export abstract class CreatePartnerOutput {
  @Field()
  readonly partner: Partner;
}
