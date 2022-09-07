import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';

// TODO move somewhere else

@ObjectType()
export class BetaFeatures {
  static readonly Props = keysOf<BetaFeatures>();
  static readonly SecuredProps = [];

  @Field()
  projectChangeRequests: boolean;
}
