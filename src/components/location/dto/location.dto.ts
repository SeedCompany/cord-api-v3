import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  NameField,
  Resource,
  Secured,
  SecuredEnum,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
} from '../../../common';
import { LocationType } from './location-type.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('location type'),
})
export abstract class SecuredLocationType extends SecuredEnum(LocationType) {}

@ObjectType({
  implements: [Resource],
})
export class Location extends Resource {
  static readonly Props = keysOf<Location>();
  static readonly SecuredProps = keysOf<SecuredProps<Location>>();

  @NameField()
  readonly name: SecuredString;

  @Field()
  readonly type: SecuredLocationType;

  @Field()
  readonly isoAlpha3: SecuredStringNullable;

  readonly fundingAccount: Secured<ID>;

  readonly defaultFieldRegion: Secured<ID>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}
