import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import {
  DbUnique,
  ID,
  NameField,
  Resource,
  Secured,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
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

declare module '~/core/resources/map' {
  interface ResourceMap {
    FieldRegion: typeof FieldRegion;
  }
}
