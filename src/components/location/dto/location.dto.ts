import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbLabel,
  DbUnique,
  NameField,
  Resource,
  type Secured,
  SecuredEnum,
  SecuredProperty,
  SecuredPropertyList,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
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
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field()
  @DbLabel('LocationType')
  readonly type: SecuredLocationType;

  @Field()
  @DbLabel('IsoAlpha3')
  readonly isoAlpha3: SecuredStringNullable;

  readonly fundingAccount: Secured<LinkTo<'FundingAccount'> | null>;

  readonly defaultFieldRegion: Secured<LinkTo<'FieldRegion'> | null>;

  readonly defaultMarketingRegion: Secured<LinkTo<'Location'> | null>;

  readonly mapImage: Secured<LinkTo<'File'> | null>;
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
