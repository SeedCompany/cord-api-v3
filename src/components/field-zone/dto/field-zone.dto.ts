import { ObjectType } from '@nestjs/graphql';
import {
  DbUnique,
  NameField,
  Resource,
  type Secured,
  SecuredProperty,
  SecuredString,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class FieldZone extends Resource {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  readonly director: Secured<LinkTo<'User'>>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field zone'),
})
export class SecuredFieldZone extends SecuredProperty(FieldZone) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    FieldZone: typeof FieldZone;
  }
}
