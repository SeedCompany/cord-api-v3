import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import {
  DateTimeFilter,
  PaginatedList,
  SecuredList,
  Sensitivity,
  SortablePaginationInput,
} from '../../../common';
import { Language } from '../../language/dto';
import { Location } from '../../location/dto';
import { User } from '../../user/dto';
import { Project } from './project.dto';
import { ProjectStatus, ProjectStatusOrStep } from './status.enum';
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

  @Field(() => [ID], {
    description: 'Only projects in ANY of these locations',
    nullable: true,
  })
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

  @Field(() => [ID], {
    description: 'User IDs ANY of which are team members',
    nullable: true,
  })
  readonly userIds?: string[];
}

const defaultFilters = {};

@InputType()
export class ProjectListInput extends SortablePaginationInput<keyof Project>({
  defaultSort: 'name',
}) {
  static defaultVal = new ProjectListInput();

  @Field({ nullable: true })
  @Type(() => ProjectFilters)
  @ValidateNested()
  readonly filter: ProjectFilters = defaultFilters;
}

@ObjectType()
export class ProjectListOutput extends PaginatedList(Project) {}

@ObjectType({
  description: SecuredList.descriptionFor('projects'),
})
export abstract class SecuredProjectList extends SecuredList(Project) {}
