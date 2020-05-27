import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredInt } from '../../../../common';

@ObjectType({
  implements: Resource,
})
export class Range extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Range as any) as Type<Range>;

  @Field()
  readonly start: SecuredInt;

  @Field()
  readonly end: SecuredInt;
}
