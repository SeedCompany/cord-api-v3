import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { IdField } from '../../../common';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class CreatePartner {
  @IdField()
  readonly organizationId: string;

  @IdField({ nullable: true })
  readonly pointOfContactId?: string;

  @Field(() => [PartnerType], { nullable: true })
  @Transform(uniq)
  readonly types?: PartnerType[] = [];

  @Field(() => [FinancialReportingType], { nullable: true })
  @Transform(uniq)
  readonly financialReportingTypes?: FinancialReportingType[] = [];

  @Field({ nullable: true })
  @Matches(/^[A-Z]{3}$/)
  readonly pmcEntityCode?: string;

  @Field({ nullable: true })
  readonly globalInnovationsClient?: boolean;

  @Field({ nullable: true })
  readonly active?: boolean;

  @Field({ nullable: true })
  readonly address?: string;
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
