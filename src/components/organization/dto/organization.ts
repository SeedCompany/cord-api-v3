import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Organization as any) as Type<Organization>;

  @Field()
  readonly name: SecuredString;
}
