import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, ServerException, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  property,
  sorting,
} from '../../core/database/query';
import { Role } from '../authorization';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestListInput,
  ReviewProjectChangeRequest,
  ProjectChangeRequestStatus as Status,
} from './dto';

@Injectable()
export class ProjectChangeRequestRepository extends DtoRepository<
  typeof ProjectChangeRequest,
  [session?: Session]
>(ProjectChangeRequest) {
  async create(input: CreateProjectChangeRequest) {
    const result = await this.db
      .query()
      .apply(
        await createNode(ProjectChangeRequest, {
          initialProps: {
            types: input.types,
            summary: input.summary,
            status: Status.Draft,
            reviewers: input.reviewers ?? [],
          },
        })
      )
      .apply(
        createRelationships(ProjectChangeRequest, 'in', {
          changeset: ['Project', input.projectId],
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create project change request');
    }
    return result.id;
  }

  protected hydrate(session?: Session) {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', '', 'changeset', ACTIVE),
          node('project', 'Project'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .return<{ dto: UnsecuredDto<ProjectChangeRequest> }>(
          merge('props', {
            canEdit: `props.status = "${Status.Draft}" OR props.status = "${Status.PendingReview}"`,
            project: 'project.id',
          }).as('dto')
        );
  }

  async list(input: ProjectChangeRequestListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'ProjectChangeRequest'),
        ...(input.filter.projectId
          ? [
              relation('in', '', 'changeset', ACTIVE),
              node('project', 'Project', {
                id: input.filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(sorting(ProjectChangeRequest, input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async createReview(input: ReviewProjectChangeRequest, roles: Role[]) {
    await Promise.all(
      roles.map(async (role) => {
        await this.db
          .query()
          .apply(
            await createNode(ReviewProjectChangeRequest, {
              initialProps: {
                comment: input.comment,
                approved: input.approved,
              },
            })
          )
          .apply((q) => q.create([...property('role', role, 'node')]))
          .with('node')
          .apply(
            createRelationships(ReviewProjectChangeRequest, 'in', {
              review: ['ProjectChangeRequest', input.id],
            })
          )
          .return<{ id: ID }>('node.id as id')
          .first();
      })
    );
  }

  async readApprovedRoles(id: string): Promise<Role[]> {
    const result = await this.db
      .query()
      .match([
        node('node', 'ProjectChangeRequest', { id }),
        relation('out', 'rel', 'review', ACTIVE),
        node('review', 'ReviewProjectChangeRequest'),
        relation('out', '', 'approved', ACTIVE),
        node('approved', 'Property'),
      ])
      .where({
        approved: {
          value: true,
        },
      })
      .match([
        node('review'),
        relation('out', '', 'role', ACTIVE),
        node('role', 'Property'),
      ])
      .return<{ roles: Role[] }>('collect(role.value) as roles')
      .first();
    return result?.roles ?? [];
  }
}
