import { Injectable } from '@nestjs/common';
import { Node, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { CreateProjectMember, ProjectMember, ProjectMemberListInput } from '.';
import { ID, Session } from '../../../common';
import { DtoRepository, property } from '../../../core';
import {
  ACTIVE,
  matchPropsAndProjectSensAndScopedRoles,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../../core/database/query';
import { DbPropsOfDto } from '../../../core/database/results';
import { ScopedRole } from '../../authorization';

@Injectable()
export class ProjectMemberRepository extends DtoRepository(ProjectMember) {
  async verifyRelationshipEligibility(projectId: ID, userId: ID) {
    return await this.db
      .query()
      .optionalMatch(node('user', 'User', { id: userId }))
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch([
        node('project'),
        relation('out', '', 'member', ACTIVE),
        node('member', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user'),
      ])
      .return(['user', 'project', 'member'])
      .asResult<{ user?: Node; project?: Node; member?: Node }>()
      .first();
  }

  async create(
    { userId, projectId, ...input }: CreateProjectMember,
    id: ID,
    session: Session,
    createdAt: DateTime
  ) {
    const createProjectMember = this.db
      .query()
      .create([
        [
          node('newProjectMember', 'ProjectMember:BaseNode', {
            createdAt,
            id,
          }),
        ],
        ...property('roles', input.roles, 'newProjectMember'),
        ...property('modifiedAt', createdAt, 'newProjectMember'),
      ])
      .return<{ id: ID }>('newProjectMember.id as id');
    await createProjectMember.first();

    // connect the Project to the ProjectMember
    // and connect ProjectMember to User
    return await this.db
      .query()
      .match([
        [node('user', 'User', { id: userId })],
        [node('project', 'Project', { id: projectId })],
        [node('projectMember', 'ProjectMember', { id })],
      ])
      .create([
        node('project'),
        relation('out', '', 'member', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('projectMember'),
        relation('out', '', 'user', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('user'),
      ])
      .return<{ id: ID }>('projectMember.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'member', ACTIVE),
        node('node', 'ProjectMember', { id }),
        relation('out', '', 'user'),
        node('user', 'User'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return(['props', 'user.id as userId', 'scopedRoles'])
      .asResult<{
        props: DbPropsOfDto<ProjectMember, true>;
        userId: ID;
        scopedRoles: ScopedRole[];
      }>();
    return await query.first();
  }

  async list({ filter, ...input }: ProjectMemberListInput, session: Session) {
    const label = 'ProjectMember';

    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'member'),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(sorting(ProjectMember, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
