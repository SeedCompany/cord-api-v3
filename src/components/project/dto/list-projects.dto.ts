import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateFilter,
  DateTimeFilter,
  FilterField,
  ID,
  ListField,
  OptionalField,
  PaginatedList,
  SecuredList,
  SensitivitiesFilterField,
  Sensitivity,
  SortablePaginationInput,
} from '~/common';
import { LocationFilters } from '../../location/dto';
import { PartnershipFilters } from '../../partnership/dto';
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
  @OptionalField()
  readonly name?: string;

  @ListField(() => ProjectType, {
    description: 'Only projects of these types',
    optional: true,
    empty: 'omit',
  })
  readonly type?: ProjectType[];

  @SensitivitiesFilterField()
  readonly sensitivity?: readonly Sensitivity[];

  @ListField(() => ProjectStatus, {
    description: 'Only projects matching these statuses',
    optional: true,
    empty: 'omit',
  })
  readonly status?: readonly ProjectStatus[];

  @ListField(() => ProjectStep, {
    description: 'Only projects matching these steps',
    optional: true,
    empty: 'omit',
  })
  readonly step?: ProjectStep[];

  @OptionalField({
    description:
      'Only projects that are pinned/unpinned by the requesting user',
  })
  readonly pinned?: boolean;

  @OptionalField({
    description: 'Only projects created within this time range',
  })
  @Type(() => DateTimeFilter)
  @ValidateNested()
  readonly createdAt?: DateTimeFilter;

  @OptionalField({
    description: 'Only projects modified within this time range',
  })
  @Type(() => DateTimeFilter)
  @ValidateNested()
  readonly modifiedAt?: DateTimeFilter;

  @OptionalField()
  @Type(() => DateFilter)
  @ValidateNested()
  readonly mouStart?: DateFilter;

  @OptionalField()
  @Type(() => DateFilter)
  @ValidateNested()
  readonly mouEnd?: DateFilter;

  @OptionalField({
    description: 'only mine',
    deprecationReason: 'Use `isMember` instead.',
  })
  readonly mine?: boolean;

  @OptionalField({
    description: 'Only projects that the requesting user is a member of',
  })
  readonly isMember?: boolean;

  @OptionalField({
    description: 'Filter for projects with two or more engagements.',
  })
  readonly onlyMultipleEngagements?: boolean;

  @OptionalField({
    description: 'Only projects that are (not) in the "Preset Inventory"',
  })
  readonly presetInventory?: boolean;

  readonly languageId?: ID;

  readonly partnerId?: ID;

  readonly userId?: ID;

  @FilterField(() => PartnershipFilters, {
    description: 'Only projects with _any_ partnerships matching these filters',
  })
  readonly partnerships?: PartnershipFilters & {};

  @FilterField(() => PartnershipFilters)
  readonly primaryPartnership?: PartnershipFilters & {};

  @FilterField(() => LocationFilters)
  readonly primaryLocation?: LocationFilters & {};
}

@InputType()
export class ProjectListInput extends SortablePaginationInput<keyof IProject>({
  defaultSort: 'name',
}) {
  @FilterField(() => ProjectFilters)
  readonly filter?: ProjectFilters;
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
