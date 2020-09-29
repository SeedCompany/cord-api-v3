import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredKeys,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  @Field()
  readonly name: SecuredString;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Organization: Organization;
  }
  interface TypeToSecuredProps {
    Organization: SecuredKeys<Organization>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
