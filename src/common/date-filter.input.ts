import { InputType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { CalendarDate } from './calendar-date';
import { DateField, DateTimeField } from './luxon.graphql';

@InputType({
  description: 'A filter range designed for date fields',
})
export abstract class DateFilter {
  @DateField({
    description: 'After or equal to this day',
    nullable: true,
  })
  after?: CalendarDate;

  @DateField({
    description: 'Before or equal to this day',
    nullable: true,
  })
  before?: CalendarDate;
}

@InputType({
  description: 'A filter range designed for date time fields',
})
export abstract class DateTimeFilter {
  @DateTimeField({
    description: 'After or equal to this time',
    nullable: true,
  })
  after?: DateTime;

  @DateTimeField({
    description: 'Before or equal to this time',
    nullable: true,
  })
  before?: DateTime;
}
