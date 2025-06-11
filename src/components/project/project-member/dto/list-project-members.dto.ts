import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ListField,
  OptionalField,
  PaginatedList,
  Role,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { UserFilters } from '../../../user/dto';
import { ProjectFilters } from '../../dto';
import { ProjectMember } from './project-member.dto';

@InputType()
export abstract class ProjectMemberFilters {
  @ListField(() => Role, {
    description: 'Only members with these roles',
    optional: true,
    empty: 'omit',
  })
  readonly roles?: readonly Role[];

  @OptionalField()
  readonly active?: boolean;

  @FilterField(() => ProjectFilters)
  readonly project?: ProjectFilters & {};

  @FilterField(() => UserFilters)
  readonly user?: UserFilters & {};
}

@InputType()
export class ProjectMemberListInput extends SortablePaginationInput<keyof ProjectMember>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => ProjectMemberFilters)
  readonly filter?: ProjectMemberFilters;
}

@ObjectType()
export class ProjectMemberListOutput extends PaginatedList(ProjectMember) {}

@ObjectType({
  description: SecuredList.descriptionFor('project members'),
})
export abstract class SecuredProjectMemberList extends SecuredList(ProjectMember) {}
