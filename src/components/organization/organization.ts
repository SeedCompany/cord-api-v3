import { Field, Int, ObjectType, ID, InputType } from 'type-graphql';
import { BaseNode } from '../../common/base-node';

@ObjectType()
@InputType('OrganizationInput')
export class Organization extends BaseNode{

  @Field(type => String, {nullable: true})
  name: string;
}
