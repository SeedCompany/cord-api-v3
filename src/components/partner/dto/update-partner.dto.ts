import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { Matches, ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { IdField } from '../../../common';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class UpdatePartner {
  @IdField()
  readonly id: string;

  @IdField({ nullable: true })
  readonly pointOfContactId?: string;

  @Field(() => [PartnerType], { nullable: true })
  @Transform(uniq)
  readonly types?: PartnerType[];

  @Field(() => FinancialReportingType, { nullable: true })
  readonly financialReportingType?: FinancialReportingType | null;

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
