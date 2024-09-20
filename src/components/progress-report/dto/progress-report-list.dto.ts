import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  OmitType,
  PaginatedList,
  PickType,
  SecuredList,
} from '~/common';
import { EngagementFilters } from '../../engagement/dto';
import { PeriodicReportListInput } from '../../periodic-report/dto';
import { ProgressReportStatus } from './progress-report-status.enum';
import { ProgressReport } from './progress-report.entity';

@InputType()
export abstract class ProgressReportFilters extends PickType(
  PeriodicReportListInput,
  ['start', 'end', 'parent'],
) {
  @Field(() => [ProgressReportStatus], {
    nullable: true,
  })
  readonly status?: readonly ProgressReportStatus[];

  @FilterField(() => EngagementFilters)
  readonly engagement?: EngagementFilters & {};
}

@InputType()
export class ProgressReportListInput extends OmitType(PeriodicReportListInput, [
  'type',
  'start',
  'end',
  'parent',
]) {
  @FilterField(() => ProgressReportFilters)
  readonly filter?: ProgressReportFilters;
}

@ObjectType({
  description: SecuredList.descriptionFor('progress reports'),
})
export abstract class ProgressReportList extends SecuredList(ProgressReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('progress reports'),
}) {}
