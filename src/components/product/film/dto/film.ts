import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../../common';
import { Range } from '../../range/dto';

@ObjectType({
  implements: Resource,
})
export class Film extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Film as any) as Type<Film>;

  @Field()
  readonly name: SecuredString;

  @Field(() => Range, { nullable: true })
  readonly range: Range;
}
