import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { IdField } from '../../../common';
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
