import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  NameField,
  Resource,
  Secured,
  SecuredProperty,
  SecuredPropertyList,
  SecuredProps,
  SecuredString,
} from '~/common';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.FieldRegion })
@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  static readonly Props = keysOf<FieldRegion>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldRegion>>();

  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  readonly fieldZone: Secured<LinkTo<'FieldZone'>>;

  readonly director: Secured<LinkTo<'User'>>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field region'),
})
export class SecuredFieldRegion extends SecuredProperty(FieldRegion) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('a list of field regions'),
})
export class SecuredFieldRegions extends SecuredPropertyList(FieldRegion) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    FieldRegion: typeof FieldRegion;
  }
  interface ResourceDBMap {
    FieldRegion: typeof e.default.FieldRegion;
  }
}
