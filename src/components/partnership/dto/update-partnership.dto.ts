import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  CalendarDate,
  DateField,
  ID,
  IdField,
  ListField,
  OptionalField,
} from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { PartnerType } from '../../partner/dto';
import { FinancialReportingType } from './financial-reporting-type.enum';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { Partnership } from './partnership.dto';

@InputType()
export abstract class UpdatePartnership {
  @IdField()
  readonly id: ID;

  @OptionalField(() => PartnershipAgreementStatus)
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field({ description: 'The partner agreement', nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly agreement?: CreateDefinedFileVersionInput;

  @Field({ description: 'The MOU agreement', nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly mou?: CreateDefinedFileVersionInput;

  @OptionalField(() => PartnershipAgreementStatus)
  readonly mouStatus?: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  readonly mouStartOverride?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly mouEndOverride?: CalendarDate | null;

  @ListField(() => PartnerType, { optional: true })
  readonly types?: readonly PartnerType[];

  @Field(() => FinancialReportingType, { nullable: true })
  readonly financialReportingType?: FinancialReportingType | null;

  @OptionalField()
  readonly primary?: boolean;
}

@InputType()
export abstract class UpdatePartnershipInput {
  @ChangesetIdField()
  readonly changeset?: ID;

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
