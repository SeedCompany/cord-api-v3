import { Field, ObjectType } from '@nestjs/graphql';
import { Resource } from '../../../common';
import { SecuredFundingAccount } from '../../funding-account';
import { SecuredRegion } from '../../location';
import { SecuredMarketingLocation } from '../../marketing-location';
import { SecuredPrivateLocation } from '../../private-location';
import { SecuredRegistryOfGeography } from '../../registry-of-geography';

@ObjectType({
  implements: [Resource],
})
export class PublicLocation extends Resource {
  @Field()
  readonly fieldRegion: SecuredRegion;

  @Field()
  readonly marketingLocation: SecuredMarketingLocation;

  @Field()
  readonly privateLocation: SecuredPrivateLocation;

  @Field()
  readonly registryOfGeography: SecuredRegistryOfGeography;

  @Field()
  readonly fundingAccount: SecuredFundingAccount;
}
