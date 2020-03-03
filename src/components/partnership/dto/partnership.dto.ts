import { ObjectType, Field, registerEnumType } from "type-graphql";
import { Resource, SecuredProperty, DateTimeField, SecuredDateTime, SecuredList } from "../../../common";
import { GraphQLString, GraphQLNonNull, GraphQLList } from "graphql";
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
  description: SecuredProperty.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredProperty<PartnershipAgreementStatus>(
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

  @Field(() => [PartnershipType])
  readonly types: PartnershipType[];
}
