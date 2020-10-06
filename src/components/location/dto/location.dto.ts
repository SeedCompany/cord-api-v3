import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredEnum,
  SecuredKeys,
  SecuredProperty,
  SecuredString,
  Sensitivity,
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

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field()
  readonly iso31663: SecuredString;

  readonly fundingAccount: Secured<string>;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    Location: Location;
  }
  interface TypeToSecuredProps {
    Location: SecuredKeys<Location> | 'sensitivity';
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a location'),
})
export class SecuredLocation extends SecuredProperty(Location) {}
