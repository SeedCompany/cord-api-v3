import { Field, ObjectType } from '@nestjs/graphql';
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
  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}
