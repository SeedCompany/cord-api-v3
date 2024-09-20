import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  OmitType,
  PaginatedList,
  PickType,
  SecuredList,
} from '~/common';
import { PeriodicReportListInput } from '../../periodic-report/dto';
import { ProgressReport } from './progress-report.entity';

@InputType()
export abstract class ProgressReportFilters extends PickType(
  PeriodicReportListInput,
  ['start', 'end', 'parent'],
) {}

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
