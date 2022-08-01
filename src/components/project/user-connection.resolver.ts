import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, ListArg, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { User } from '../user';
import { ProjectListInput, SecuredProjectList } from './dto';
import { ProjectLoader, ProjectService } from './index';

@Resolver(User)
export class ProjectUserConnectionResolver {
  constructor(private readonly projectService: ProjectService) {}
  @ResolveField(() => SecuredProjectList)
  async projects(
    @AnonSession() session: Session,
    @Parent() { id }: User,
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) loader: LoaderOf<ProjectLoader>
  ) {
    const list = await this.projectService.listProjectsByUserId(
      id,
      input,
      session
    );
    loader.primeAll(list.items);
    return list;
  }
}
