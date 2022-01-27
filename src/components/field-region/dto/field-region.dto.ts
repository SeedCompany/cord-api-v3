/* eslint-disable @typescript-eslint/naming-convention */
import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
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

@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  static readonly Props = keysOf<FieldRegion>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldRegion>>();
  static readonly TablesToDto = {
    id: 'id',
    name: 'name',
    director: 'director',
    field_zone: 'fieldZone',
    created_at: 'createdAt',
  };

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
