import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  DbUnique,
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
import { SecuredCommunicationRegions } from './communication-region';
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
  @DbUnique()
  readonly name: SecuredString;

  @Field()
  @DbLabel('LocationType')
  readonly type: SecuredLocationType;

  @Field()
  @DbLabel('IsoAlpha3')
  readonly isoAlpha3: SecuredStringNullable;

  @Field()
  @DbLabel('CommunicationRegion')
  readonly communicationRegions: SecuredCommunicationRegions;

  readonly fundingAccount: Secured<ID | null>;

  readonly defaultFieldRegion: Secured<ID | null>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}
