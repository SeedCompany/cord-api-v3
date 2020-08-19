import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateTimeFilter,
  PaginatedList,
  SecuredList,
  Sensitivity,
  SortablePaginationInput,
} from '../../../common';
import { IProject, Project } from './project.dto';
import { ProjectStatus } from './status.enum';
import { ProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

@InputType()
export abstract class ProjectFilters {
  @Field({
    description: 'Only projects matching this name',
    nullable: true,
  })
  readonly name?: string;

  @Field(() => ProjectType, {
    description: 'Only projects of this type',
    nullable: true,
  })
  readonly type?: ProjectType;

  @Field(() => [Sensitivity], {
    description: 'Only projects with these sensitivities',
    nullable: true,
  })
  readonly sensitivity?: Sensitivity[];

  @Field(() => [ProjectStatus], {
    description: 'Only projects matching these statuses',
    nullable: true,
  })
  readonly status?: ProjectStatus[];

  @Field(() => [ProjectStep], {
    description: 'Only projects matching these steps',
    nullable: true,
  })
  readonly step?: ProjectStep[];

  readonly locationIds?: string[];

  @Field({
    nullable: true,
    description: 'Only projects created within this time range',
  })
  readonly createdAt?: DateTimeFilter;

  @Field({
    nullable: true,
    description: 'Only projects modified within this time range',
  })
  readonly modifiedAt?: DateTimeFilter;

  // User IDs ANY of which are team members
  readonly userIds?: string[];

  @Field({
    nullable: true,
    description: 'only mine',
  })
  readonly mine?: boolean;

  @Field({
    nullable: true,
    description:
      'When a project works on more than one language it is a "cluster" project. It has more than one engagement',
  })
  readonly clusters?: boolean;
}

const defaultFilters = {};

@InputType()
export class ProjectListInput extends SortablePaginationInput<keyof IProject>({
  defaultSort: 'name',
}) {
  static defaultVal = new ProjectListInput();

  @Field({ nullable: true })
  @Type(() => ProjectFilters)
  @ValidateNested()
  readonly filter: ProjectFilters = defaultFilters;
}

@ObjectType()
export class ProjectListOutput extends PaginatedList<IProject, Project>(
  IProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('projects'),
  }
) {}

@ObjectType({
  description: SecuredList.descriptionFor('projects'),
})
export abstract class SecuredProjectList extends SecuredList<IProject, Project>(
  IProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('projects'),
  }
) {}
