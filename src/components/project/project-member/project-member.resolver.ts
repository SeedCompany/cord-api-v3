import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Identity } from '~/core/authentication';
import { ProjectMemberLoader, ProjectMemberService } from '../project-member';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberCreated,
  ProjectMemberDeleted,
  ProjectMemberUpdated,
  UpdateProjectMember,
} from './dto';

@Resolver(ProjectMember)
export class ProjectMemberResolver {
  constructor(
    private readonly service: ProjectMemberService,
    private readonly identity: Identity,
  ) {}

  @ResolveField(() => Boolean, {
    nullable: true,
  })
  active(@Parent() member: ProjectMember): boolean | null {
    return member.inactiveAt.canRead ? !member.inactiveAt.value : null;
  }

  @Mutation(() => ProjectMemberCreated, {
    description: 'Create a project member',
  })
  async createProjectMember(
    @Args('input') input: CreateProjectMember,
    @Loader(ProjectMemberLoader) loader: LoaderOf<ProjectMemberLoader>,
  ): Promise<ProjectMemberCreated> {
    const member = await this.service.create(input);
    loader.prime(member.id, member);
    return {
      __typename: 'ProjectMemberCreated',
      projectId: member.project.id,
      memberId: member.id,
      at: member.createdAt,
      by: this.identity.current.userId,
    };
  }

  @Mutation(() => ProjectMemberUpdated, {
    description: 'Update a project member',
  })
  async updateProjectMember(
    @Args('input') input: UpdateProjectMember,
    @Loader(ProjectMemberLoader) loader: LoaderOf<ProjectMemberLoader>,
  ): Promise<ProjectMemberUpdated> {
    const { member, payload } = await this.service.update(input);
    loader.prime(member.id, member);
    return {
      __typename: 'ProjectMemberUpdated',
      projectId: member.project.id,
      memberId: member.id,
      by: this.identity.current.userId,
      updated: {},
      previous: {},
      // if actual changes, then this overrides those empty values.
      ...payload,
      at: payload?.at ?? DateTime.now(),
    };
  }

  @Mutation(() => ProjectMemberDeleted, {
    description: 'Delete a project member',
  })
  async deleteProjectMember(@IdArg() id: ID): Promise<ProjectMemberDeleted> {
    const payload = await this.service.delete(id);
    return {
      __typename: 'ProjectMemberDeleted',
      projectId: payload.project,
      memberId: payload.member,
      ...payload,
    };
  }
}
