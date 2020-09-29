import { ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredKeys,
  SecuredProperty,
} from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  readonly organization: Secured<string>;

  readonly pointOfContact: Secured<string>;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Partner: Partner;
  }
  interface TypeToSecuredProps {
    Partner: SecuredKeys<Partner>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
