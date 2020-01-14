import { Field, ID, ObjectType } from 'type-graphql';
import { Region } from '../region/region';

@ObjectType()
export class Area implements IArea {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  region: Region;

  static from(area: Area) {
    return Object.assign(new Area(), area);
  }
}

export interface IArea {
  id: string;
  name: string | null;
  region: Region;
}
