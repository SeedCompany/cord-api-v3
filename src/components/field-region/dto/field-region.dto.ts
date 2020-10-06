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
export class FieldRegion extends Resource {
  @Field()
  readonly name: SecuredString;

  readonly fieldZone: Secured<string>;

  readonly director: Secured<string>;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    FieldRegion: FieldRegion;
  }
  interface TypeToSecuredProps {
    FieldRegion: SecuredKeys<FieldRegion>;
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field region'),
})
export class SecuredFieldRegion extends SecuredProperty(FieldRegion) {}
