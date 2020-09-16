import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { PartnerType } from './partner-type.enum';
import { Partner } from './partner.dto';

@InputType()
export abstract class UpdatePartner {
  @IdField()
  readonly id: string;

  @IdField({ nullable: true })
  readonly pointOfContactId?: string;

  @Field(() => [PartnerType], { nullable: true })
  readonly types?: PartnerType[];
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
