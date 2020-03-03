import { InputType, Field, ID, ObjectType } from "type-graphql";
import { DateTime } from "luxon";
import { DateTimeField } from "../../../common";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";
import { Partnership, PartnershipAgreementStatus, PartnershipType } from "./partnership.dto";

@InputType()
export class CreatePartnership {
  @Field()
  readonly agreementStatus: PartnershipAgreementStatus;

  @Field()
  readonly mouStatus: PartnershipAgreementStatus;
  
  @DateTimeField({ nullable: true })
  readonly mouStart: DateTime | null;
  
  @DateTimeField({ nullable: true })
  readonly mouEnd: DateTime | null;

  @Field(() => ID)
  readonly organizationId: string;

  @Field(type => [PartnershipType])
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