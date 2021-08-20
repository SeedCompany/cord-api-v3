import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class ProjectChangeRequestFilters {
  readonly projectId?: ID;
}

const defaultFilters = {};

@InputType()
export class ProjectChangeRequestListInput extends SortablePaginationInput<
  keyof ProjectChangeRequest
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ProjectChangeRequestListInput();

  @Type(() => ProjectChangeRequestFilters)
  @ValidateNested()
  readonly filter: ProjectChangeRequestFilters = defaultFilters;
}

@ObjectType()
export class ProjectChangeRequestListOutput extends PaginatedList(
  ProjectChangeRequest
) {}

@ObjectType({
  description: SecuredList.descriptionFor('project change requests'),
})
export abstract class SecuredProjectChangeRequestList extends SecuredList(
  ProjectChangeRequest
) {}
