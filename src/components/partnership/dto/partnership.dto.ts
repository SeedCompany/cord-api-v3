import { ObjectType, Field, registerEnumType } from 'type-graphql';
import {
  Resource,
  SecuredProperty,
  DateTimeField,
  SecuredDateTime,
} from '../../../common';
import { GraphQLString, GraphQLNonNull, GraphQLList } from 'graphql';
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

  @DateTimeField()
  readonly mouStart: SecuredDateTime;

  @DateTimeField()
  readonly mouEnd: SecuredDateTime;

  @Field(type => Organization, { nullable: true })
  readonly organization: Organization;

  @Field(() => [PartnershipType])
  readonly types: PartnershipType[];
}
