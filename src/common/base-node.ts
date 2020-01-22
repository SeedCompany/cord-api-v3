import { ObjectType, Field, ID } from 'type-graphql';
import { User } from 'src/components/user/user';
import { Organization } from 'src/components/organization/organization';

@ObjectType()
export class BaseNode {
  @Field(type => ID)
  id: string;

  @Field(type => User)
  modifiedByUser: User;

  @Field(type => Organization)
  owningOrg: Organization;

  @Field(type => String)
  createdOn: string;

  @Field(type => String, { nullable: true })
  deletedOn: string;

  @Field(type => User)
  createdBy: User;
}
