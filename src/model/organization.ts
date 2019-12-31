import { Field, Int, ObjectType, ID } from 'type-graphql';

@ObjectType()
export class Organization {

  @Field(type => String, {nullable: true})
  id: string;

  @Field(type => String, {nullable: true})
  name: string;

}
