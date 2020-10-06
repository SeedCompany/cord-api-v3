import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, Secured, SecuredProperty } from '../../../common';
import { SecuredPartnerTypes } from './partner-type.enum';

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  readonly organization: Secured<string>;

  readonly pointOfContact: Secured<string>;

  @Field()
  readonly types: SecuredPartnerTypes;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
