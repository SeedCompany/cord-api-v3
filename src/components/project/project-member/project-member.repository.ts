import { Injectable } from '@nestjs/common';
import { Node, node, Relation, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  UpdateProjectMember,
} from '.';
import {
  CalendarDate,
  generateId,
  ID,
  Sensitivity,
  Session,
  UnsecuredDto,
} from '../../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  property,
} from '../../../core';
import { DbChanges } from '../../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  collect,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  BaseNode,
  PropListDbResult,
  StandardReadResult,
} from '../../../core/database/results';
import { Role } from './dto';

@Injectable()
export class ProjectMemberRepository {
  constructor(private readonly db: DatabaseService) {}

  async verifyRelationshipEligibility(projectId: ID, userId: ID) {
    return await this.db
      .query()
      .optionalMatch(node('user', 'User', { id: userId }))
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch([
        node('project'),
        relation('out', '', 'member', { active: true }),
        node('member', 'ProjectMember'),
        relation('out', '', 'user', { active: true }),
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
      .return('newProjectMember.id as id');
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
      .return('projectMember.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'ProjectMember', { id })])
      .apply(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'member', { active: true }),
        node('', 'ProjectMember', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .apply(matchMemberRoles(session.userId))
      .match([node('node'), relation('out', '', 'user'), node('user', 'User')])
      .return('node, propList, user.id as userId, memberRoles')
      .asResult<
        StandardReadResult<DbPropsOfDto<ProjectMember>> & {
          userId: ID;
          memberRoles: Role[][];
        }
      >();
    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(object: ProjectMember, input: UpdateProjectMember) {
    return this.db.getActualChanges(ProjectMember, object, input);
  }

  async updateProperties(
    object: ProjectMember,
    changes: DbChanges<ProjectMember>
  ) {
    await this.db.updateProperties({
      type: ProjectMember,
      object,
      changes,
    });
  }

  async deleteNode(node: ProjectMember) {
    await this.db.deleteNode(node);
  }

   list({ filter, ...input }: ProjectMemberListInput, session: Session) {
    const label = 'ProjectMember';

    return this.db
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
      .apply(calculateTotalAndPaginateList(ProjectMember, input));
  }
}
