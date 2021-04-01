import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';
import { ReportType } from './report-type.enum';

@InputType()
export abstract class PeriodicReportFilters {
  @Field(() => ReportType, {
    nullable: true,
  })
  readonly type?: ReportType;
}

const defaultFilters = {};

@InputType()
export class PeriodicReportListInput extends SortablePaginationInput<
  keyof PeriodicReport
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PeriodicReportListInput();

  @Field({ nullable: true })
  @Type(() => PeriodicReportFilters)
  @ValidateNested()
  readonly filter: PeriodicReportFilters = defaultFilters;
}

@ObjectType()
export class PeriodicReportListOutput extends PaginatedList<
  IPeriodicReport,
  PeriodicReport
>(IPeriodicReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('periodicReports'),
}) {}

@ObjectType({
  description: SecuredList.descriptionFor('periodicReports'),
})
export abstract class SecuredPeriodicReportList extends SecuredList<
  IPeriodicReport,
  PeriodicReport
>(IPeriodicReport, {
  itemsDescription: PaginatedList.itemDescriptionFor('periodicReports'),
}) {}
