import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class BaseNode {
  @Field(type => Boolean)
  active: boolean;

  @Field(type => String)
  id: string;

  @Field(type => String)
  modifiedByUserId: string;

  @Field(type => String)
  owningOrgId: string;

  @Field(type => String)
  createdOn: string;

  @Field(type => String, { nullable: true })
  deletedOn: string;

  @Field(type => String)
  writeHash: string;
}
