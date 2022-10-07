import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ResourcesGranter } from '../policy';

// TODO move somewhere else

@ObjectType()
export class BetaFeatures {
  static readonly Props = keysOf<BetaFeatures>();
  static readonly SecuredProps = [];

  // Declaring as relations as well so privileges can use.
  static readonly Relations = {
    projectChangeRequests: '',
  };

  /**
   * A helper to grant access to beta features in a more readable way.
   * This should be used within a Policy.
   */
  static grant(
    r: ResourcesGranter,
    ...features: Array<keyof typeof BetaFeatures['Relations'] & string>
  ) {
    return r.BetaFeatures.specifically((p) => p.many(...features).edit);
  }

  @Field()
  projectChangeRequests: boolean;
}
