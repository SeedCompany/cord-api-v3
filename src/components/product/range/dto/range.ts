import { Field, ObjectType } from '@nestjs/graphql';
import { Resource } from '../../../../common';

@ObjectType({
  implements: Resource,
})
export class Range extends Resource {
  @Field()
  readonly start: number;

  @Field()
  readonly end: number;
}
