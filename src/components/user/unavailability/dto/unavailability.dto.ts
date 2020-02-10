import {
  DateTimeField,
  Resource,
  SecuredDateTime,
  SecuredString,
} from '../../../../common';
import { Field, ObjectType } from 'type-graphql';

import { DateTime } from 'luxon';

@ObjectType()
export class Unavailability extends Resource {
  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}
