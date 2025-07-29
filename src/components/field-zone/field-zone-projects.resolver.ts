import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { ProjectListInput, SecuredProjectList } from '../project/dto';
import { ProjectLoader } from '../project/project.loader';
import { FieldZone } from './dto';
import { FieldZoneService } from './field-zone.service';

@Resolver(FieldZone)
export class FieldZoneProjectsResolver {
  constructor(private readonly fieldZoneService: FieldZoneService) {}

  @ResolveField(() => SecuredProjectList, {
    description: 'The list of projects in regions within this field zone',
  })
  async projects(
    @Parent() fieldZone: FieldZone,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<SecuredProjectList> {
    const list = await this.fieldZoneService.listProjects(fieldZone, input);
    projects.primeAll(list.items);
    return list;
  }
}
