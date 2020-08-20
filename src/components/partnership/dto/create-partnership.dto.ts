import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipFundingType } from './partnership-funding-type.enum';
import { PartnershipType } from './partnership-type.enum';
import { Partnership } from './partnership.dto';

@InputType()
export class CreatePartnership {
  @IdField()
  readonly organizationId: string;

  @IdField()
  readonly projectId: string;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field({ description: 'The partner agreement', nullable: true })
  readonly agreement?: CreateDefinedFileVersionInput;

  @Field({ description: 'The MOU agreement', nullable: true })
  readonly mou?: CreateDefinedFileVersionInput;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  readonly mouStartOverride?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEndOverride?: CalendarDate;

  @Field(() => [PartnershipType], { nullable: true })
  readonly types?: PartnershipType[] = [];

  @Field(() => PartnershipFundingType, { nullable: true })
  readonly fundingType?: PartnershipFundingType;
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
