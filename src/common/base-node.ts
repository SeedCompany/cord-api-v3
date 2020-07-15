import { Field, ObjectType } from '@nestjs/graphql';
import { Organization } from '../components/organization';
import { User } from '../components/user';
import { IdField } from './id-field';

@ObjectType()
export class BaseNode {
  @IdField()
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
