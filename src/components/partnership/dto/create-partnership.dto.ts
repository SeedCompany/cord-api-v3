import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { uniq } from 'lodash';
import { CalendarDate, DateField, type ID, IdField } from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersion } from '../../file/dto';
import { PartnerType } from '../../partner/dto';
import { FinancialReportingType } from './financial-reporting-type.enum';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { Partnership } from './partnership.dto';

@InputType()
export class CreatePartnership {
  @IdField()
  readonly partner: ID<'Partner'>;

  @IdField()
  readonly project: ID<'Project'>;

  @Field(() => PartnershipAgreementStatus, { nullable: true })
  readonly agreementStatus?: PartnershipAgreementStatus;

  @Field({ description: 'The partner agreement', nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly agreement?: CreateDefinedFileVersion;

  @Field({ description: 'The MOU agreement', nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly mou?: CreateDefinedFileVersion;

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

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class CreatePartnershipOutput {
  @Field()
  readonly partnership: Partnership;
}
