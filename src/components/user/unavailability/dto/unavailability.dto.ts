import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core/resources';
import {
  Resource,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
} from '../../../../common';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class Unavailability extends Resource {
  static readonly Props = keysOf<Unavailability>();
  static readonly SecuredProps = keysOf<SecuredProps<Unavailability>>();
  static readonly Parent = import('../../dto').then((m) => m.User);

  @Field()
  readonly description: SecuredString;

  @Field()
  readonly start: SecuredDateTime;

  @Field()
  readonly end: SecuredDateTime;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Unavailability: typeof Unavailability;
  }
}
