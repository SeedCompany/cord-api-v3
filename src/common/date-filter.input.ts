import { DateTime } from 'luxon';
import { InputType } from 'type-graphql';
import { DateField, DateTimeField } from './luxon.graphql';

@InputType({
  description: 'A filter range designed for date fields',
})
export abstract class DateFilter {
  @DateField({
    description: 'After or equal to this day',
    nullable: true,
  })
  after?: DateTime;

  @DateField({
    description: 'Before or equal to this day',
    nullable: true,
  })
  before?: DateTime;
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
