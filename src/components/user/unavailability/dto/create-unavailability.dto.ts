import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, type ID, IdField } from '~/common';
import { Unavailability } from './unavailability.dto';

@InputType()
export class CreateUnavailability {
  @IdField()
  readonly user: ID<'User'>;

  @Field()
  readonly description: string;

  @DateTimeField()
  readonly start: DateTime;

  @DateTimeField()
  readonly end: DateTime;
}

@ObjectType()
export abstract class CreateUnavailabilityOutput {
  @Field()
  readonly unavailability: Unavailability;
}
