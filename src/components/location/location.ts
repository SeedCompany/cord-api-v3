import { Field, ID, ObjectType } from 'type-graphql';
import { Area } from '../area/area';

@ObjectType()
export class Location implements ILocation {
  @Field(() => ID)
  id: string;

  @Field()
  country: string;

  @Field()
  area: Area;

  @Field()
  editable: boolean;

  static from(location: Location) {
    return Object.assign(new Location(), location);
  }
}

export interface ILocation {
  id: string;
  country: string | null;
  area: Area;
  editable: boolean;
}
