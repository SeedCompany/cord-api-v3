import { InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ListField } from '~/common';
import { ScheduleStatus } from './schedule-status.enum';

@InputType()
export abstract class ProgressSummaryFilters {
  @ListField(() => ScheduleStatus, {
    optional: true,
    nullable: 'items',
    description: stripIndent`
      Filter by schedule status.
      - \`[X, Y]\` will allow summaries with either X or Y status.
      - \`[null, X]\` will allow missing summaries or summaries with X status.
      - \`[null]\` will filter to only missing summaries.
      - \`null\` and \`[]\` will be ignored.
    `,
    empty: 'omit',
  })
  readonly scheduleStatus?: ReadonlyArray<ScheduleStatus | null>;
}
