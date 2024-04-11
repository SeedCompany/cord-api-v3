import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateTimeFilter,
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SensitivitiesFilter,
  Sensitivity,
  SortablePaginationInput,
} from '~/common';
import { ProjectStatus } from './project-status.enum';
import { ProjectStep } from './project-step.enum';
import { ProjectType } from './project-type.enum';
import {
  InternshipProject,
  IProject,
  Project,
  TranslationProject,
} from './project.dto';

@InputType()
export abstract class ProjectFilters {
  @Field(() => [ProjectType], {
    description: 'Only projects of these types',
    nullable: true,
  })
  readonly type?: ProjectType[];

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

  readonly languageId?: ID;

  readonly partnerId?: ID;

  readonly userId?: ID;
}

@InputType()
export class ProjectListInput extends SortablePaginationInput<keyof IProject>({
  defaultSort: 'name',
}) {
  @FilterField(ProjectFilters)
  readonly filter: ProjectFilters;
}

@ObjectType()
export class ProjectListOutput extends PaginatedList<IProject, Project>(
  IProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('projects'),
  },
) {}

@ObjectType()
export class TranslationProjectListOutput extends PaginatedList(
  TranslationProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('translation projects'),
  },
) {}

@ObjectType()
export class InternshipProjectListOutput extends PaginatedList(
  InternshipProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('internship projects'),
  },
) {}

@ObjectType({
  description: SecuredList.descriptionFor('projects'),
})
export abstract class SecuredProjectList extends SecuredList<IProject, Project>(
  IProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('projects'),
  },
) {}

@ObjectType({
  description: SecuredList.descriptionFor('translation projects'),
})
export abstract class SecuredTranslationProjectList extends SecuredList(
  TranslationProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('translation projects'),
  },
) {}

@ObjectType({
  description: SecuredList.descriptionFor('internship projects'),
})
export abstract class SecuredInternshipProjectList extends SecuredList(
  InternshipProject,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('internship projects'),
  },
) {}
