import { Type } from '@nestjs/common';
import { Field, ObjectType, InterfaceType, createUnionType } from 'type-graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';
import { SecuredUser } from '../../user/dto';

@InterfaceType()
export abstract class Place {
  @Field()
  name: SecuredString;
}

@ObjectType({
  implements: [Resource, Place],
})
export class Zone extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Zone as any) as Type<Zone>;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly director: SecuredUser;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a zone'),
})
export class SecuredZone extends SecuredProperty(Zone) {}

@ObjectType({
  implements: [Resource, Place],
})
export class Region extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Region as any) as Type<Region>;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly zone: SecuredZone;

  @Field()
  readonly director: SecuredUser;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a region'),
})
export class SecuredRegion extends SecuredProperty(Region) {}

@ObjectType({
  implements: [Resource, Place],
})
export class Country extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Country as any) as Type<Country>;

  @Field()
  name: SecuredString;

  @Field()
  region: SecuredRegion;
}

export const Location = createUnionType({
  name: 'Location',
  types: () => [Country.classType, Region.classType, Zone.classType],
  resolveType: value => {
    if ('region' in value) {
      return Country.classType;
    }
    if ('zone' in value) {
      return Region.classType;
    }
    return Zone.classType;
  },
});
export type Location = Country | Region | Zone;
