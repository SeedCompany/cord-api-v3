import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ScheduleStatus } from './schedule-status.enum';

@InputType()
export abstract class ProgressSummaryFilters {
  @Field(() => [ScheduleStatus], {
    nullable: 'itemsAndList',
    description: stripIndent`
      Filter by schedule status.
      - \`[X, Y]\` will allow summaries with either X or Y status.
      - \`[null, X]\` will allow missing summaries or summaries with X status.
      - \`[null]\` will filter to only missing summaries.
      - \`null\` and \`[]\` will be ignored.
    `,
  })
  readonly scheduleStatus?: ReadonlyArray<ScheduleStatus | null>;
}
