import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { CalendarDate, DateField, ID, IdField } from '../../../common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { PartnerType } from '../../partner/dto';
import { FinancialReportingType } from './financial-reporting-type.enum';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { Partnership } from './partnership.dto';

@InputType()
export class CreatePartnership {
  @IdField()
  readonly partnerId: ID;

  @IdField()
  readonly projectId: ID;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field({ description: 'The partner agreement', nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly agreement?: CreateDefinedFileVersionInput;

  @Field({ description: 'The MOU agreement', nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly mou?: CreateDefinedFileVersionInput;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  readonly mouStartOverride?: CalendarDate;

  @DateField({ nullable: true })
  readonly mouEndOverride?: CalendarDate;

  @Field(() => [PartnerType], { nullable: true })
  @Transform(({ value }) => uniq(value))
  readonly types?: PartnerType[] = [];

  @Field(() => FinancialReportingType, { nullable: true })
  readonly financialReportingType?: FinancialReportingType;

  @Field({ nullable: true })
  readonly primary?: boolean = false;
}

@InputType()
export abstract class CreatePartnershipInput {
  @ChangesetIdField()
  readonly changeset?: ID;

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
