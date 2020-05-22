import { Type } from '@nestjs/common';
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredInt } from '../../../../common';

@ObjectType({
  implements: [Resource],
})
export class Range extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Range as any) as Type<Range>;

  @Field()
  readonly rangeStart: SecuredInt;

  @Field()
  readonly rangeEnd: SecuredInt;
}

@InputType()
export abstract class RangeInput {
  @Field()
  readonly rangeStart: number;

  @Field()
  readonly rangeEnd: number;
}

@InputType()
export abstract class UpdateRange {
  @Field()
  readonly rangeStart: number;

  @Field()
  readonly rangeEnd: number;
}
