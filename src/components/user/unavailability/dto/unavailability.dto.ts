import { Field, ObjectType } from 'type-graphql';
import {
  DateTimeField,
  Resource,
  SecuredDateTime,
  SecuredString,
} from '../../../../common';

@ObjectType()
export class Unavailability extends Resource {
  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}
