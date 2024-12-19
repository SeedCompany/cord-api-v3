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
import { FinancialReportingType } from '../../partnership/dto';
import { ProjectType } from '../../project/dto';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class UpdatePartner {
  @IdField()
  readonly id: ID;

  @IdField({ nullable: true })
  readonly pointOfContactId?: ID | null;

  @Field(() => [PartnerType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly types?: readonly PartnerType[];

  @Field(() => [FinancialReportingType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly financialReportingTypes?: readonly FinancialReportingType[];

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
  @Transform(({ value }) => (value ? uniq(value) : undefined))
  readonly countries?: ReadonlyArray<ID<'Location'>>;

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => (value ? uniq(value) : undefined))
  readonly fieldRegions?: ReadonlyArray<ID<'FieldRegion'>>;

  @Field(() => [IDType], { name: 'languagesOfConsulting', nullable: true })
  @Transform(({ value }) => (value ? uniq(value) : undefined))
  readonly languagesOfConsulting?: ReadonlyArray<ID<'Language'>>;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate | null;

  @Field(() => [ProjectType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly approvedPrograms?: ProjectType[];
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
