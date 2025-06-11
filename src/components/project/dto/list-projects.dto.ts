import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { set } from 'lodash';
import {
  DateFilter,
  DateTimeFilter,
  FilterField,
  type ID,
  ListField,
  OptionalField,
  PaginatedList,
  SecuredList,
  SensitivitiesFilterField,
  type Sensitivity,
  SortablePaginationInput,
} from '~/common';
import { Transform } from '~/common/transform.decorator';
import { LocationFilters } from '../../location/dto';
import { PartnershipFilters } from '../../partnership/dto';
import { ProjectMemberFilters } from '../project-member/dto';
import { ProjectStatus } from './project-status.enum';
import { ProjectStep } from './project-step.enum';
import { ProjectType } from './project-type.enum';
import {
  InternshipProject,
  IProject,
  type Project,
  TranslationProject,
} from './project.dto';

@InputType()
export abstract class ProjectFilters {
  readonly id?: ID<'Project'>;

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

  @FilterField(() => ProjectMemberFilters, {
    description:
      "Only projects with the requesting user's membership that matches these filters",
  })
  @Transform(({ value, obj }) => {
    // Only ran when GQL specifies membership
    if (value.active == null && (obj.mine || obj.isMember)) {
      value.active = true;
    }
    return value;
  })
  readonly membership?: ProjectMemberFilters & {};

  @FilterField(() => ProjectMemberFilters, {
    description: 'Only projects with _any_ members matching these filters',
  })
  readonly members?: ProjectMemberFilters & {};

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

Object.defineProperty(ProjectFilters.prototype, 'mine', {
  set(value: boolean) {
    // Ensure this is set when membership has not been declared
    value && !this.membership && set(this, 'membership.active', true);
  },
});
OptionalField(() => Boolean, {
  description: 'only mine',
  deprecationReason: 'Use `isMember` instead.',
})(ProjectFilters.prototype, 'mine');

Object.defineProperty(ProjectFilters.prototype, 'isMember', {
  set(value: boolean) {
    // Ensure this is set when membership has not been declared
    value && !this.membership && set(this, 'membership.active', true);
  },
});
OptionalField(() => Boolean, {
  description:
    'Only projects that the requesting user is an active member of. false does nothing.',
})(ProjectFilters.prototype, 'isMember');

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
