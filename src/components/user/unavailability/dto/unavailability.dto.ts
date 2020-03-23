import { Type } from '@nestjs/common';
import { Field, ObjectType } from 'type-graphql';
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
  /* TS wants a public constructor for "ClassType" */
  static classType = (Unavailability as any) as Type<Unavailability>;

  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}
