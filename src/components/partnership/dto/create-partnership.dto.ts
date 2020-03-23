import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { CalendarDate, DateField } from '../../../common';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';
import { Partnership } from './partnership.dto';

@InputType()
export class CreatePartnership {
  @Field(() => ID)
  readonly organizationId: string;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  readonly mouStart?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEnd?: CalendarDate;

  @Field(() => [PartnershipType], { nullable: true })
  readonly types?: PartnershipType[];
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
