import { ObjectType, Field, registerEnumType } from "type-graphql";
import { Resource, SecuredProperty, DateTimeField, SecuredDateTime } from "../../../common";
import { GraphQLString } from "graphql";
import { Organization } from "../../organization";

export enum PartnershipAgreementStatus {
  NonAttached = 'NonAttached',
  AwaitingSignature = 'AwaitingSignature',
  Signed = 'Signed',
}

export enum PartnershipType {
  Managing = 'Managing',
  Funding = 'Funding',
  Impact = 'Impact',
  Technical = 'Technical',
  Resource = 'Resource',
}

registerEnumType(PartnershipAgreementStatus, { name: 'PartnershipAgreementStatus' });

registerEnumType(PartnershipType, { name: 'PartnershipType' });

@ObjectType({
  description: SecuredProperty.descriptionFor('a string'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredProperty<string>(
  GraphQLString,
) {}

@ObjectType()
export class Partnership extends Resource {
  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  readonly mouStatus: SecuredPartnershipAgreementStatus;

  @DateTimeField()
  readonly mouStart: SecuredDateTime;

  @DateTimeField()
  readonly mouEnd: SecuredDateTime;

  @Field(type => Organization, { nullable: true })
  readonly organization: Organization;

  @Field(type => [PartnershipType])
  readonly types: PartnershipType[];
}
