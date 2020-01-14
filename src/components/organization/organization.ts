import { Field, Int, ObjectType, ID } from 'type-graphql';
import { BaseNode } from '../../common/base-node';

@ObjectType()
export class Organization extends BaseNode{

  @Field(type => String, {nullable: true})
  name: string;

}
