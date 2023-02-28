import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  Role,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ProjectMember } from './project-member.dto';

@InputType()
export abstract class ProjectMemberFilters {
  @Field(() => [Role], {
    description: 'Only members with these roles',
    nullable: true,
  })
  readonly roles?: Role[];

  readonly projectId?: ID;
}

@InputType()
export class ProjectMemberListInput extends SortablePaginationInput<
  keyof ProjectMember
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(ProjectMemberFilters)
  readonly filter: ProjectMemberFilters;
}

@ObjectType()
export class ProjectMemberListOutput extends PaginatedList(ProjectMember) {}

@ObjectType({
  description: SecuredList.descriptionFor('project members'),
})
export abstract class SecuredProjectMemberList extends SecuredList(
  ProjectMember,
) {}
