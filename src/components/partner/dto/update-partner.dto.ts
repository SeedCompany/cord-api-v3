import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { ID, IdField, IdOf, IsId, NameField } from '../../../common';
import { Location } from '../../../components/location';
import { FieldRegion } from '../../field-region';
import type { Language } from '../../language';
import { FinancialReportingType } from '../../partnership/dto';
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
  readonly types?: PartnerType[];

  @Field(() => [FinancialReportingType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly financialReportingTypes?: FinancialReportingType[];

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
  readonly languageOfWiderCommunicationId?: IdOf<Language> | null;

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => (value ? uniq(value) : undefined))
  readonly countries?: ReadonlyArray<IdOf<Location>>;

  @Field(() => [IDType], { nullable: true })
  @IsId({ each: true })
  @Transform(({ value }) => (value ? uniq(value) : undefined))
  readonly fieldRegions?: ReadonlyArray<IdOf<FieldRegion>>;
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
