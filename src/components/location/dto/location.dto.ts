import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  DbLabel,
  DbUnique,
  ID,
  IdOf,
  NameField,
  Resource,
  Secured,
  SecuredEnum,
  SecuredProperty,
  SecuredPropertyList,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { LocationType } from './location-type.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('location type'),
})
export abstract class SecuredLocationType extends SecuredEnum(LocationType) {}

@RegisterResource({ db: e.Location })
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

  readonly fundingAccount: Secured<ID | null>;

  readonly defaultFieldRegion: Secured<ID | null>;

  readonly defaultMarketingRegion: Secured<IdOf<Location> | null>;

  readonly mapImage: DefinedFile;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('a list of locations'),
})
export class SecuredLocations extends SecuredPropertyList(Location) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Location: typeof Location;
  }
  interface ResourceDBMap {
    Location: typeof e.default.Location;
  }
}
