import { InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';

@InterfaceType()
export abstract class Resource {
  @IdField()
  readonly id: string;

  @DateTimeField()
  readonly createdAt: DateTime;

  protected constructor() {
    // no instantiation, shape only
  }
}
