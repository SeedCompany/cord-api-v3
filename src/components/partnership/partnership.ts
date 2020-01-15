import { DateTime } from 'luxon';
import { Organization } from '../organization/organization';
import { PartnershipAgreementStatus } from './agreement-status';
import { PartnershipType } from './partnership-type';
import { Field, GraphQLISODateTime } from 'type-graphql';

export class Partnership {
  @Field(type => PartnershipAgreementStatus, {nullable: true})
  agreementStatus: PartnershipAgreementStatus;

  @Field(type => PartnershipAgreementStatus, {nullable: true})
  mouStatus: PartnershipAgreementStatus;

  @Field(type => GraphQLISODateTime, {nullable: true})
  mouStart: DateTime | null;

  @Field(type => GraphQLISODateTime, {nullable: true})
  mouEnd: DateTime | null;

  @Field(type => Organization, {nullable: true})
  organization: Organization;

  @Field(type => [PartnershipType], {nullable: true})
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
