import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { PaginatedList, SecuredList, SortablePaginationInput } from '../../../common';
import { Project } from './project';

@InputType()
export abstract class ProjectFilters {
  @Field({
    description: 'Only projects matching this name',
    nullable: true,
  })
  readonly name?: string;

  @Field(() => [ID], {
    description: 'User IDs ANY of which must belong to the projects',
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
export abstract class SecuredProjectList extends SecuredList(
    Project,
) {}
