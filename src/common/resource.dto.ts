import { DateTime } from 'luxon';
import { Field, ID, InterfaceType } from 'type-graphql';
import { DateTimeField } from './luxon.graphql';

@InterfaceType()
export abstract class Resource {
  @Field(() => ID)
  readonly id: string;

  @DateTimeField()
  readonly createdAt: DateTime;

  protected constructor() {
    // no instantiation, shape only
  }
}
