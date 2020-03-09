import { GraphQLString } from 'graphql';
import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredDate, SecuredProperty } from '../../../common';
import { Organization } from '../../organization';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';

@ObjectType({
  description: SecuredProperty.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredProperty<
  PartnershipAgreementStatus
>(GraphQLString) {}

@ObjectType()
export class Partnership extends Resource {
  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  @Field()
  readonly mouStatus: SecuredPartnershipAgreementStatus;

  @Field()
  readonly mouStart: SecuredDate;

  @Field()
  readonly mouEnd: SecuredDate;

  @Field(() => Organization)
  readonly organization: Organization;

  @Field(() => [PartnershipType])
  readonly types: PartnershipType[];
}
