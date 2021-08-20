import { InputType, ObjectType } from '@nestjs/graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';

@InputType()
export class PeriodicReportListInput extends SortablePaginationInput<
  keyof PeriodicReport
>({
  defaultSort: 'end',
}) {
  static defaultVal = new PeriodicReportListInput();
}

@ObjectType()
export class PeriodicReportListOutput extends PaginatedList<
  IPeriodicReport,
  PeriodicReport
>(IPeriodicReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('periodic reports'),
}) {}

@ObjectType({
  description: SecuredList.descriptionFor('periodic reports'),
})
export abstract class SecuredPeriodicReportList extends SecuredList<
  IPeriodicReport,
  PeriodicReport
>(IPeriodicReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('periodic reports'),
}) {}
