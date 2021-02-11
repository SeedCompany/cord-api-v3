import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  Resource,
  SecuredDateTime,
  SecuredString,
} from '../../../../common';

@ObjectType({
  implements: [Resource],
})
export class Unavailability extends Resource {
  static readonly Props = keysOf<Unavailability>();

  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}
