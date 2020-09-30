import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredKeys,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class FieldZone extends Resource {
  @Field()
  readonly name: SecuredString;

  readonly director: Secured<string>;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    FieldZone: FieldZone;
  }
  interface TypeToSecuredProps {
    FieldZone: SecuredKeys<FieldZone>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field zone'),
})
export class SecuredFieldZone extends SecuredProperty(FieldZone) {}
