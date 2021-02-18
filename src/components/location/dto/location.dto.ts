import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredBoolean,
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
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly type: SecuredLocationType;

  @Field()
  readonly isoAlpha3: SecuredStringNullable;

  readonly fundingAccount: Secured<string>;

  readonly defaultFieldRegion: Secured<string>;

  readonly canDelete: SecuredBoolean;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}
