import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  @Field()
  readonly name: SecuredString;
}
