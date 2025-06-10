import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { CreationFailed, type ID, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import {
  type CreateProjectChangeRequest,
  ProjectChangeRequest,
  type ProjectChangeRequestListInput,
  ProjectChangeRequestStatus as Status,
} from './dto';

@Injectable()
export class ProjectChangeRequestRepository extends DtoRepository(
  ProjectChangeRequest,
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
            applied: false,
            editable: true, //needs to be editable on creation
          },
        }),
      )
      .apply(
        createRelationships(ProjectChangeRequest, 'in', {
          changeset: ['Project', input.projectId],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new CreationFailed(ProjectChangeRequest);
    }
    return result.id;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', '', 'changeset', ACTIVE),
          node('project', 'Project'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .return<{ dto: UnsecuredDto<ProjectChangeRequest> }>(
          merge('props', {
            canEdit: `props.status = "${Status.Pending}"`,
            project: 'project.id',
          }).as('dto'),
        );
  }

  async list(input: ProjectChangeRequestListInput) {
    const result = await this.db
      .query()
      .match([
        node('node', 'ProjectChangeRequest'),
        ...(input.filter?.projectId
          ? [
              relation('in', '', 'changeset', ACTIVE),
              node('project', 'Project', {
                id: input.filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(sorting(ProjectChangeRequest, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
