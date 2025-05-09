import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  NameField,
  Resource,
  type Secured,
  SecuredProperty,
  type SecuredProps,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.FieldZone })
@ObjectType({
  implements: [Resource],
})
export class FieldZone extends Resource {
  static readonly Props = keysOf<FieldZone>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldZone>>();

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
  interface ResourceDBMap {
    FieldZone: typeof e.default.FieldZone;
  }
}
