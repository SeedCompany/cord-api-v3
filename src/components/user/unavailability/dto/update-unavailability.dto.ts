import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { DateTimeField, ID, IdField } from '~/common';
import { Unavailability } from './unavailability.dto';

@InputType()
export abstract class UpdateUnavailability {
  @IdField()
  readonly id: ID;

  @Field({ nullable: true })
  readonly description?: string;

  @DateTimeField({ nullable: true })
  readonly start?: DateTime;

  @DateTimeField({ nullable: true })
  readonly end?: DateTime;
}

@InputType()
export abstract class UpdateUnavailabilityInput {
  @Field()
  @Type(() => UpdateUnavailability)
  @ValidateNested()
  readonly unavailability: UpdateUnavailability;
}

@ObjectType()
export abstract class UpdateUnavailabilityOutput {
  @Field()
  readonly unavailability: Unavailability;
}
