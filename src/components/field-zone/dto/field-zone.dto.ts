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
export class FieldZone extends Resource {
  static readonly Props = keysOf<FieldZone>();
  static readonly SecuredProps = keysOf<SecuredProps<FieldZone>>();
  static readonly TablesToDto = {
    id: 'id',
    name: 'name',
    director: 'director',
    created_at: 'createdAt',
  };

  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  readonly director: Secured<ID>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field zone'),
})
export class SecuredFieldZone extends SecuredProperty(FieldZone) {}
