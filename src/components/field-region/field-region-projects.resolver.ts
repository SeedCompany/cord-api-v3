import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import { ProjectLoader } from '../project/project.loader';
import { FieldRegion } from './dto';
import { FieldRegionService } from './field-region.service';

@Resolver(FieldRegion)
export class FieldRegionProjectsResolver {
  constructor(private readonly fieldRegionService: FieldRegionService) {}

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects in this field region',
  })
  async projects(
    @Parent() fieldRegion: FieldRegion,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.fieldRegionService.listProjects(fieldRegion, input);
    projects.primeAll(list.items);
    return list;
  }
}
