import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  DbUnique,
  ID,
  NameField,
  Resource,
  Secured,
  SecuredProperty,
  SecuredPropertyList,
  SecuredProps,
  SecuredString,
} from '../../../common';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  static readonly DB = e.FieldRegion;
  static readonly Props = keysOf<FieldRegion>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldRegion>>();

  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  readonly fieldZone: Secured<ID>;

  readonly director: Secured<ID>;
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
}
