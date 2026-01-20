import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, type ID, IdField, OptionalField } from '~/common';
import { Unavailability } from './unavailability.dto';

@InputType()
export abstract class UpdateUnavailability {
  @IdField()
  readonly id: ID;

  @OptionalField()
  readonly description?: string;

  @DateTimeField({ optional: true })
  readonly start?: DateTime;

  @DateTimeField({ optional: true })
  readonly end?: DateTime;
}

@ObjectType()
export abstract class UnavailabilityUpdated {
  @Field()
  readonly unavailability: Unavailability;
}
