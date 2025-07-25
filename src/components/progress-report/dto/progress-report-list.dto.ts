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
import { PnpExtractionResultFilters } from '../../pnp/extraction-result';
import { ProgressSummaryFilters } from '../../progress-summary/dto';
import { ProgressReportStatus } from './progress-report-status.enum';
import { ProgressReport } from './progress-report.dto';

@InputType()
export abstract class ProgressReportFilters extends PickType(
  PeriodicReportListInput,
  ['start', 'end', 'parent'],
) {
  @Field(() => [ProgressReportStatus], {
    nullable: true,
  })
  readonly status?: readonly ProgressReportStatus[];

  @FilterField(() => ProgressSummaryFilters)
  readonly cumulativeSummary?: ProgressSummaryFilters & {};

  @FilterField(() => EngagementFilters)
  readonly engagement?: EngagementFilters & {};

  @FilterField(() => PnpExtractionResultFilters)
  readonly pnpExtractionResult?: PnpExtractionResultFilters & {};
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
