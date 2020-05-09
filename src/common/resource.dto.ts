import { Field, ID, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
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
