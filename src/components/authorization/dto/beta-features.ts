import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Calculated, ResourceRelationsShape } from '~/common';
import { RegisterResource } from '~/core';
import { Granter, ResourceGranter } from '../policy';

// TODO move somewhere else

@RegisterResource()
@Calculated()
@ObjectType()
export class BetaFeatures {
  static readonly Props = keysOf<BetaFeatures>();
  static readonly SecuredProps = [];

  // Declaring as relations as well so privileges can use.
  static readonly Relations = {
    projectChangeRequests: undefined,
    newProgressReports: undefined,
  } satisfies ResourceRelationsShape;

  @Field()
  projectChangeRequests: boolean;

  @Field()
  newProgressReports: boolean;
}

@Granter(BetaFeatures)
export class BetaFeaturesGranter extends ResourceGranter<typeof BetaFeatures> {
  grant(...features: Array<keyof BetaFeatures & string>) {
    return this.specifically((p) => p.many(...features).edit);
  }
}

declare module '../policy/granters' {
  interface GrantersOverride {
    BetaFeatures: BetaFeaturesGranter;
  }
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    BetaFeatures: typeof BetaFeatures;
  }
}
