import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateTimeFilter,
  ID,
  PaginatedList,
  SecuredList,
  SensitivitiesFilter,
  Sensitivity,
  SortablePaginationInput,
} from '../../../common';
import { IProject, Project } from './project.dto';
import { ProjectStatus } from './status.enum';
import { ProjectStep } from './step.enum';
import { ProjectType } from './type.enum';

@InputType()
export abstract class ProjectFilters {
  @Field(() => ProjectType, {
    description: 'Only projects of this type',
    nullable: true,
  })
  readonly type?: ProjectType;

  @Field(() => [Sensitivity], {
    description: 'Only projects with these sensitivities',
    nullable: true,
  })
  @SensitivitiesFilter()
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

  @Field({
    description:
      'Only projects that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;

  readonly locationIds?: ID[];

  @Field({
    nullable: true,
    description: 'Only projects created within this time range',
  })
  @Type(() => DateTimeFilter)
  @ValidateNested()
  readonly createdAt?: DateTimeFilter;

  @Field({
    nullable: true,
    description: 'Only projects modified within this time range',
  })
  @Type(() => DateTimeFilter)
  @ValidateNested()
  readonly modifiedAt?: DateTimeFilter;

  // User IDs ANY of which are team members
  readonly userIds?: ID[];

  @Field({
    nullable: true,
    description: 'only mine',
  })
  readonly mine?: boolean;

  @Field({
    nullable: true,
    description: 'Filter for projects with two or more engagements.',
  })
  readonly onlyMultipleEngagements?: boolean;

  @Field({
    nullable: true,
    description: 'Only projects that are (not) in the "Preset Inventory"',
  })
  readonly presetInventory?: boolean;
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
