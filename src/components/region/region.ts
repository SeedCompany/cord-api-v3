import { Field, ID, ObjectType, InputType } from 'type-graphql';

@ObjectType()
@InputType('RegionInput')
export class Region implements IRegion {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  static from(region: Region) {
    return Object.assign(new Region(), region);
  }
}

export interface IRegion {
  id: string;
  name: string | null;
}
