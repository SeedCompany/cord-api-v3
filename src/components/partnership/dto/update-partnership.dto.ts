import { InputType, Field, ID, ObjectType } from "type-graphql";
import { PartnershipAgreementStatus, Partnership } from "./partnership.dto";
import { DateTimeField } from "../../../common";
import { DateTime } from "luxon";
import { PartnershipType } from "../partnership-type";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";

@InputType()
export abstract class UpdatePartnership {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field({ nullable: true })
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateTimeField({ nullable: true })
  readonly mouStart?: DateTime;

  @DateTimeField({ nullable: true })
  readonly mouEnd?: DateTime;

  @Field(() => ID, { nullable: true })
  readonly organizationId?: string;

  @Field(type => [PartnershipType], { nullable: true})
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