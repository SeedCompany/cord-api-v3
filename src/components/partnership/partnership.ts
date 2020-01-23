import { Field, InputType, ObjectType } from 'type-graphql';
import { DateTime } from 'luxon';
import { DateField } from '../../common';
import { Organization } from '../organization';
import { PartnershipAgreementStatus } from './agreement-status';
import { PartnershipType } from './partnership-type';

@ObjectType()
@InputType('PartnershipInput')
export class Partnership {
  @Field(type => String, { nullable: true })
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => String, { nullable: true })
  mouStatus: PartnershipAgreementStatus;

  @DateField({ nullable: true })
  mouStart: DateTime | null;

  @DateField({ nullable: true })
  mouEnd: DateTime | null;

  organization: Organization;

  @Field(type => [PartnershipType], { nullable: true })
  types: PartnershipType[];
}

export interface Partnership {
  agreementStatus: PartnershipAgreementStatus;
  mouStatus: PartnershipAgreementStatus;
  mouStart: DateTime | null;
  mouEnd: DateTime | null;
  organization: Organization;
  types: PartnershipType[];
}
