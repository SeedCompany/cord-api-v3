import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  Secured,
  SecuredEnum,
  SecuredProperty,
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

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly type: SecuredLocationType;

  @Field()
  readonly isoAlpha3: SecuredStringNullable;

  readonly fundingAccount: Secured<string>;

  readonly defaultFieldRegion: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}
