import { DateTime } from 'luxon';
import { Field, ObjectType } from 'type-graphql';
import { DateTimeField, Editable, Readable, Resource } from '../../../../common';

@ObjectType({
  implements: [Readable, Editable],
})
export class Unavailability extends Resource implements Readable, Editable {
  @Field()
  readonly description: string;

  @DateTimeField()
  readonly start: DateTime;

  @DateTimeField()
  readonly end: DateTime;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}
