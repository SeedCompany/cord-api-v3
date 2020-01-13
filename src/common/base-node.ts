import { ObjectType, Field } from 'type-graphql';
import { DateTime } from 'neo4j-driver/types/v1';

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

  @Field(type => DateTime)
  createdOn: DateTime;

  @Field(type => DateTime, { nullable: true })
  deletedOn: DateTime;

  @Field(type => String)
  writeHash: string;
}
