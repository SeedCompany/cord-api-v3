import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredDateTime,
  SecuredProps,
  SecuredString,
} from '../../../../common';

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
