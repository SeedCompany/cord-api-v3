import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { DateTimeField, ID, IdField } from '~/common';
import { Unavailability } from './unavailability.dto';

@InputType()
export class CreateUnavailability {
  @IdField()
  readonly userId: ID;

  @Field()
  readonly description: string;

  @DateTimeField()
  readonly start: DateTime;

  @DateTimeField()
  readonly end: DateTime;
}

@InputType()
export abstract class CreateUnavailabilityInput {
  @Field()
  @Type(() => CreateUnavailability)
  @ValidateNested()
  readonly unavailability: CreateUnavailability;
}

@ObjectType()
export abstract class CreateUnavailabilityOutput {
  @Field()
  readonly unavailability: Unavailability;
}
