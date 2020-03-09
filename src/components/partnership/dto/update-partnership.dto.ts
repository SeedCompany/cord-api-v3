import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { DateTimeField } from '../../../common';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class UpdatePartnership {
  @Field(() => ID)
  readonly id: string;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateTimeField({ nullable: true })
  readonly mouStart?: DateTime;

  @DateTimeField({ nullable: true })
  readonly mouEnd?: DateTime;

  @Field(() => ID, { nullable: true })
  readonly organizationId?: string;

  @Field(() => [PartnershipType], { nullable: true })
  readonly types?: PartnershipType[];
}

@InputType()
export abstract class UpdatePartnershipInput {
  @Field()
  @Type(() => UpdatePartnership)
  @ValidateNested()
  readonly partnership: UpdatePartnership;
}

@ObjectType()
export abstract class UpdatePartnershipOutput {
  @Field()
  readonly partnership: Partnership;
}
