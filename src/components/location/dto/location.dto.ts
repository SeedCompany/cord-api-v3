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
export class Region extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Region as any) as Type<Region>;

  @Field()
  readonly name: SecuredString;

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
export class Area extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Area as any) as Type<Area>;

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly region: SecuredRegion;

  @Field()
  readonly director: SecuredUser;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an area'),
})
export class SecuredArea extends SecuredProperty(Area) {}

@ObjectType({
  implements: [Resource, Place],
})
export class Country extends Resource implements Place {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Country as any) as Type<Country>;

  @Field()
  name: SecuredString;

  @Field()
  area: SecuredArea;
}

export const Location = createUnionType({
  name: 'Location',
  types: () => [Country.classType, Area.classType, Region.classType],
  resolveType: value => {
    if ('area' in value) {
      return Country.classType;
    }
    if ('region' in value) {
      return Area.classType;
    }
    return Region.classType;
  },
});
export type Location = Country | Area | Region;
