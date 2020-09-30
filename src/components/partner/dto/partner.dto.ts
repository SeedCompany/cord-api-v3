import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredEnumList,
  SecuredKeys,
  SecuredProperty,
} from '../../../common';
import { PartnerType } from './partner-type.enum';

@ObjectType({
  description: SecuredEnumList.descriptionFor('partnership types'),
})
export abstract class SecuredPartnerTypes extends SecuredEnumList(
  PartnerType
) {}

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  readonly organization: Secured<string>;

  readonly pointOfContact: Secured<string>;

  @Field()
  readonly types: SecuredPartnerTypes;
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
