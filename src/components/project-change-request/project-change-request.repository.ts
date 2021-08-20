import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
} from '../../core/database/query';
import {
  CreateProjectChangeRequest,
  ProjectChangeRequest,
  ProjectChangeRequestListInput,
  ProjectChangeRequestStatus as Status,
} from './dto';

@Injectable()
export class ProjectChangeRequestRepository extends DtoRepository(
  ProjectChangeRequest
) {
  async create(input: CreateProjectChangeRequest) {
    const result = await this.db
      .query()
      .apply(
        await createNode(ProjectChangeRequest, {
          initialProps: {
            types: input.types,
            summary: input.summary,
            status: Status.Pending,
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

  async readOne(id: ID, session?: Session) {
    const query = this.db
      .query()
      .match([
        node('node', 'ProjectChangeRequest', { id }),
        relation('in', '', 'changeset', ACTIVE),
        node('project', 'Project'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return<{ dto: UnsecuredDto<ProjectChangeRequest> }>(
        merge('props', {
          scope: 'scopedRoles',
          canEdit: `props.status = "${Status.Pending}"`,
        }).as('dto')
      );
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find project change request');
    }

    return result.dto;
  }

  async list(input: ProjectChangeRequestListInput, _session: Session) {
    const result = await this.db
      .query()
      .match([
        // requestingUser(session),
        // ...permissionsOfNode(label),
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
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
