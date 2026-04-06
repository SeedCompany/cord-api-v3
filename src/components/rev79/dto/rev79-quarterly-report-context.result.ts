import { Field, ObjectType } from '@nestjs/graphql';
import { CalendarDate, type ID, IdField } from '~/common';

@ObjectType({
  description:
    'Resolved Cord identifiers and date range for a Rev79 quarterly progress report.',
})
export class Rev79QuarterlyReportContextResult {
  @IdField({
    description: 'The Cord project ID corresponding to the Rev79 project.',
  })
  readonly project: ID<'Project'>;

  @IdField({
    description:
      'The Cord language engagement ID corresponding to the Rev79 community.',
  })
  readonly engagement: ID<'LanguageEngagement'>;

  @IdField({
    description: 'The Cord progress report ID for the requested quarter.',
  })
  readonly progressReport: ID<'ProgressReport'>;

  @Field({
    description:
      'The start date of the progress report (first day of the quarter).',
  })
  readonly start: CalendarDate;

  @Field({
    description:
      'The end date of the progress report (last day of the quarter).',
  })
  readonly end: CalendarDate;
}
