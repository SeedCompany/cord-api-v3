import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../../common';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';
import { Partnership } from './partnership.dto';

@InputType()
export class CreatePartnership {
  @Field(() => PartnershipAgreementStatus)
  readonly agreementStatus: PartnershipAgreementStatus;

  @Field(() => PartnershipAgreementStatus)
  readonly mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  readonly mouStart: DateTime | null;

  @DateField({ nullable: true })
  readonly mouEnd: DateTime | null;

  @Field(() => ID)
  readonly organizationId: string;

  @Field(() => [PartnershipType])
  readonly types: PartnershipType[];
}

@InputType()
export abstract class CreatePartnershipInput {
  @Field()
  @Type(() => CreatePartnership)
  @ValidateNested()
  readonly partnership: CreatePartnership;
}

@ObjectType()
export abstract class CreatePartnershipOutput {
  @Field()
  readonly partnership: Partnership;
}
