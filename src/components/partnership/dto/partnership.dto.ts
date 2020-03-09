import { GraphQLString } from 'graphql';
import { Field, ObjectType } from 'type-graphql';
import {
  DateTimeField,
  Resource,
  SecuredDateTime,
  SecuredProperty,
} from '../../../common';
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

  @Field(() => Organization, { nullable: true })
  readonly organization: Organization | null;

  @Field(() => [PartnershipType])
  readonly types: PartnershipType[];
}
