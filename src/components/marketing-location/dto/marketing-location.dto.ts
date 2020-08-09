import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class MarketingLocation extends Resource {
  @Field()
  readonly name: SecuredString;
}
