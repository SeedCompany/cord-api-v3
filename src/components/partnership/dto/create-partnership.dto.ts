import { InputType, Field, ID, ObjectType } from 'type-graphql';
import { DateTime } from 'luxon';
import { DateTimeField } from '../../../common';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Partnership } from './partnership.dto';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';

@InputType()
export class CreatePartnership {
  @Field(() => PartnershipAgreementStatus)
  readonly agreementStatus: PartnershipAgreementStatus;

  @Field(() => PartnershipAgreementStatus)
  readonly mouStatus: PartnershipAgreementStatus;

  @DateTimeField({ nullable: true })
  readonly mouStart: DateTime | null;

  @DateTimeField({ nullable: true })
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
