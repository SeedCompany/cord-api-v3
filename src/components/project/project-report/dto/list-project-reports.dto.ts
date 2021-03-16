import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { ProjectReport } from './project-report.dto';
import { ReportType } from './report';

@InputType()
export abstract class ProjectReportFilters {
  @Field(() => ReportType, {
    nullable: true,
  })
  readonly reportType?: ReportType;

  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class ProjectReportListInput extends SortablePaginationInput<
  keyof ProjectReport
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ProjectReportListInput();

  @Field({ nullable: true })
  @Type(() => ProjectReportFilters)
  @ValidateNested()
  readonly filter: ProjectReportFilters = defaultFilters;
}

@ObjectType()
export class ProjectReportListOutput extends PaginatedList(ProjectReport) {}

@ObjectType({
  description: SecuredList.descriptionFor('project reports'),
})
export abstract class SecuredProjectReportList extends SecuredList(
  ProjectReport
) {}
