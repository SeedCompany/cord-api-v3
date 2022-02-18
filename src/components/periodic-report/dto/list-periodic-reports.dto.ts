import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { IPeriodicReport, PeriodicReport } from './periodic-report.dto';
import { ReportType } from './report-type.enum';

@InputType()
export class PeriodicReportListInput extends SortablePaginationInput<
  keyof PeriodicReport
>({
  defaultSort: 'end',
}) {
  @Field(() => ReportType, {
    description: stripIndent`
      Limit reports to this type.
      Not applicable in fields for concrete report types.
    `,
    nullable: true,
  })
  readonly type?: ReportType;

  readonly parent?: ID;

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
