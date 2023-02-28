import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ProjectChangeRequest } from './project-change-request.dto';

@InputType()
export abstract class ProjectChangeRequestFilters {
  readonly projectId?: ID;
}

@InputType()
export class ProjectChangeRequestListInput extends SortablePaginationInput<
  keyof ProjectChangeRequest
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(ProjectChangeRequestFilters, { internal: true })
  readonly filter: ProjectChangeRequestFilters;
}

@ObjectType()
export class ProjectChangeRequestListOutput extends PaginatedList(
  ProjectChangeRequest,
) {}

@ObjectType({
  description: SecuredList.descriptionFor('project change requests'),
})
export abstract class SecuredProjectChangeRequestList extends SecuredList(
  ProjectChangeRequest,
) {}
