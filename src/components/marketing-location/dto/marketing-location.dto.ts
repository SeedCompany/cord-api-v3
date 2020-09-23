import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class MarketingLocation extends Resource {
  @Field()
  readonly name: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a marketing location'),
})
export class SecuredMarketingLocation extends SecuredProperty(
  MarketingLocation
) {}
