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
  @Field()
  readonly name: SecuredString;

  @Field(() => SecuredRange, { nullable: true })
  readonly ranges: SecuredRange;
}
