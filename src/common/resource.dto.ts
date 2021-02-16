import { Field, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { SecuredBoolean } from '.';
import { IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';

@InterfaceType()
export abstract class Resource {
  @IdField()
  readonly id: string;

  @DateTimeField()
  readonly createdAt: DateTime;

  @Field({
    description: 'Whether the requesting user can delete this resource',
  })
  readonly canDelete: SecuredBoolean;

  protected constructor() {
    // no instantiation, shape only
  }
}
