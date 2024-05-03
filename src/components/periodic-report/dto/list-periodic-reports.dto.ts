import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
  DateFilter,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { PeriodicReport } from './merge-periodic-reports.dto';
import { IPeriodicReport } from './periodic-report.dto';
import { ReportType } from './report-type.enum';

@InputType()
export class PeriodicReportListInput extends SortablePaginationInput<
  keyof PeriodicReport
>({
  defaultSort: 'start',
}) {
  @Field(() => ReportType, {
    description: stripIndent`
      Limit reports to this type.
      Not applicable in fields for concrete report types.
    `,
    nullable: true,
  })
  readonly type?: ReportType;

  @Field({
    nullable: true,
    description: 'Filter reports on the start date',
  })
  @Type(() => DateFilter)
  @ValidateNested()
  readonly start?: DateFilter;

  @Field({
    nullable: true,
    description: 'Filter reports on the end date',
  })
  @Type(() => DateFilter)
  @ValidateNested()
  readonly end?: DateFilter;

  readonly parent?: ID;
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
