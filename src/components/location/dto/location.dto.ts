import {
  createUnionType,
  Field,
  InterfaceType,
  ObjectType,
} from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredProperty,
  SecuredString,
} from '../../../common';

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
export type Location = Country | Region | Zone;
