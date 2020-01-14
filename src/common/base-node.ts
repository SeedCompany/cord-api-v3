import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class BaseNode {

  @Field(type => String)
  id: string;

  @Field(type => String)
  owningOrgId: string;

  @Field(type => String)
  createdAt: string;

  @Field(type => String, { nullable: true })
  deletedAt: string;

  @Field(type => String)
  createdByUserId: string;

  @Field(type => String, { nullable: true })
  deletedByUserId: string;

  @Field(type => String)
  writeHash: string;
}
