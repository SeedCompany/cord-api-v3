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
export abstract class SecuredStoryRange extends SecuredPropertyList(Range) {}

@ObjectType({
  implements: Resource,
})
export class Story extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Story as any) as Type<Story>;

  @Field()
  readonly name: SecuredString;

  @Field(() => SecuredStoryRange, { nullable: true })
  readonly ranges: SecuredStoryRange;
}
