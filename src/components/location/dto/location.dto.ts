import {
  createUnionType,
  Field,
  InterfaceType,
  ObjectType,
} from '@nestjs/graphql';
import {
  Resource,
  SecuredProperty,
  SecuredString,
  Sensitivity,
} from '../../../common';
import { SecuredFundingAccount } from '../../funding-account';
import { SecuredMarketingLocation } from '../../marketing-location';
import { SecuredRegistryOfGeography } from '../../registry-of-geography';
import { SecuredUser } from '../../user/dto/user.dto';
import { PrivateLocationType } from './private-location-type.enum';

@InterfaceType()
export abstract class Place {
  @Field()
  name: SecuredString;
}

@ObjectType({
  implements: [Resource, Place],
})
export class Zone extends Resource implements Place {
  @Field()
  readonly name: SecuredString;

  readonly director: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a zone'),
})
export class SecuredZone extends SecuredProperty(Zone) {}

@ObjectType({
  implements: [Resource, Place],
})
export class Region extends Resource implements Place {
  @Field()
  readonly name: SecuredString;

  readonly zone: Secured<string>;

  readonly director: Secured<string>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a region'),
})
export class SecuredRegion extends SecuredProperty(Region) {}

@ObjectType({
  implements: [Resource, Place],
})
export class Country extends Resource implements Place {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly region: SecuredRegion;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a country'),
})
export class SecuredCountry extends SecuredProperty(Country) {}

export const Location = createUnionType({
  name: 'Location',
  types: () => [Country, Region, Zone] as any, // ignore errors for abstract classes
  resolveType: (value) => {
    if ('region' in value) {
      return Country;
    }
    if ('zone' in value) {
      return Region;
    }
    return Zone;
  },
});
export type Location = Region | Zone;

@ObjectType({
  implements: [Resource],
})
export class PrivateLocation extends Resource {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly publicName: SecuredString;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field(() => PrivateLocationType)
  readonly type: PrivateLocationType;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a private location'),
})
export class SecuredPrivateLocation extends SecuredProperty(PrivateLocation) {}

@ObjectType({
  implements: [Resource],
})
export class PublicLocation extends Resource {
  @Field()
  readonly fieldRegion: SecuredRegion;

  @Field()
  readonly marketingLocation: SecuredMarketingLocation;

  @Field()
  readonly privateLocation: SecuredPrivateLocation;

  @Field()
  readonly registryOfGeography: SecuredRegistryOfGeography;

  @Field()
  readonly fundingAccount: SecuredFundingAccount;
}
