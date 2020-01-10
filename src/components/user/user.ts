import { Field, ID, Int, ObjectType } from 'type-graphql';

//export class User implements IUser {
//import { User as IUser } from '@cord/data';
@ObjectType()
export class User {
  @Field(type => String)
  id: string;

  @Field(type => String)
  email: string;

  @Field()
  realFirstName: string;

  @Field()
  realLastName: string;

  @Field()
  displayFirstName: string;

  @Field()
  displayLastName: string;

  static from(user: User) {
    return Object.assign(new User(), user);
  }
}
