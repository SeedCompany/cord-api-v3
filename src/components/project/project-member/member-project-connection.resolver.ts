import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { IProject, type Project } from '../dto';
import { ProjectMember } from './dto';
import { MembershipByProjectAndUserLoader } from './membership-by-project-and-user.loader';

@Resolver(IProject)
export class MemberProjectConnectionResolver {
  @ResolveField(() => ProjectMember)
  async membership(
    @Parent() project: Project,
    @IdArg({ name: 'user' }) userId: ID<'User'>,
    @Loader(() => MembershipByProjectAndUserLoader)
    loader: LoaderOf<MembershipByProjectAndUserLoader>,
  ): Promise<ProjectMember> {
    const { membership } = await loader.load({
      project: project.id,
      user: userId,
    });
    return membership;
  }
}
