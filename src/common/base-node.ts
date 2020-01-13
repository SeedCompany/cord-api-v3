import { ObjectType, Field, ID } from 'type-graphql';
import { User } from '../components/user/user';
import { Organization } from '../components/organization/organization';

@ObjectType()
export class BaseNode {
  @Field(type => ID)
  id: string;

  @Field(type => Organization)
  owningOrg: Organization;

  @Field()
  createdAt: string;

  @Field(type => User)
  createdBy: User;
}
