import { Field, InputType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateField, DateTimeField } from './luxon.graphql';
import { CalendarDate } from './temporal';

@InputType({
  description: 'A filter range designed for date fields',
})
export abstract class DateFilter {
  @DateField({
    description: 'After this day',
    nullable: true,
  })
  after?: CalendarDate;

  @DateField({
    description: 'After or equal to this day',
    nullable: true,
  })
  afterInclusive?: CalendarDate;

  @DateField({
    description: 'Before this day',
    nullable: true,
  })
  before?: CalendarDate;

  @DateField({
    description: 'Before or equal to this day',
    nullable: true,
  })
  beforeInclusive?: CalendarDate;

  @Field({ description: 'Whether the field is null or not', nullable: true })
  isNull?: boolean;
}

@InputType({
  description: 'A filter range designed for date time fields',
})
export abstract class DateTimeFilter {
  @DateTimeField({
    description: 'After this time',
    nullable: true,
  })
  after?: DateTime;

  @DateTimeField({
    description: 'After or equal to this time',
    nullable: true,
  })
  afterInclusive?: DateTime;

  @DateTimeField({
    description: 'Before this time',
    nullable: true,
  })
  before?: DateTime;

  @DateTimeField({
    description: 'Before or equal to this time',
    nullable: true,
  })
  beforeInclusive?: DateTime;

  @Field({ description: 'Whether the field is null or not', nullable: true })
  isNull?: boolean;
}
