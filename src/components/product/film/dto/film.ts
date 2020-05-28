import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredPropertyList,
  SecuredString,
} from '../../../../common';
import { Range } from '../../range/dto';

@ObjectType({
  description: SecuredPropertyList.descriptionFor('ranges'),
})
export abstract class SecuredRange extends SecuredPropertyList(Range) {}

@ObjectType({
  implements: Resource,
})
export class Film extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Film as any) as Type<Film>;

  @Field()
  readonly name: SecuredString;

  @Field(() => SecuredRange, { nullable: true })
  readonly ranges: SecuredRange;
}
