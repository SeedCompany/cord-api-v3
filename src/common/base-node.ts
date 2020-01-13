import { ObjectType, Field, ID } from 'type-graphql';
import { User } from 'src/components/user/user';

@ObjectType()
export class BaseNode {
  @Field(type => ID)
  id: string;

  @Field(type => String)
  modifiedByUserId: string;

  @Field(type => String)
  owningOrgId: string;

  @Field(type => String)
  createdOn: string;

  @Field(type => String, { nullable: true })
  deletedOn: string;

  @Field(type => User)
  createdBy: User;
}
