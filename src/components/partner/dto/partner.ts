import { ObjectType } from '@nestjs/graphql';
import { Resource, Secured, SecuredProperty } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  readonly organization: Secured<string>;

  readonly pointOfContact: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
