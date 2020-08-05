import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { ProjectMember } from './project-member.dto';
import { Role } from './role.dto';

@InputType()
export abstract class ProjectMemberFilters {
  @Field(() => [Role], {
    description: 'Only members with these roles',
    nullable: true,
  })
  readonly roles?: Role[];

  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class ProjectMemberListInput extends SortablePaginationInput<
  keyof ProjectMember
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ProjectMemberListInput();

  @Field({ nullable: true })
  @Type(() => ProjectMemberFilters)
  @ValidateNested()
  readonly filter: ProjectMemberFilters = defaultFilters;
}

@ObjectType()
export class ProjectMemberListOutput extends PaginatedList(ProjectMember) {}

@ObjectType({
  description: SecuredList.descriptionFor('project members'),
})
export abstract class SecuredProjectMemberList extends SecuredList(
  ProjectMember
) {}
