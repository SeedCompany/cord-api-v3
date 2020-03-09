import { Field, ID, ObjectType } from 'type-graphql';
import { Organization } from '../components/organization';
import { User } from '../components/user';

@ObjectType()
export class BaseNode {
  @Field(() => ID)
  id: string;

  @Field(() => User)
  modifiedByUser: User;

  @Field(() => Organization)
  owningOrg: Organization;

  @Field(() => String)
  createdOn: string;

  @Field(() => String, { nullable: true })
  deletedOn: string;

  @Field(() => User)
  createdBy: User;
}
