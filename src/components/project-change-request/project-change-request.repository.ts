import { Injectable } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
} from '../../core/database/query';
import { ProjectStatus } from '../project';
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
  async create(input: CreateProjectChangeRequest, session: Session) {
    const secureProps = [
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'summary',
        value: input.summary,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'status',
        value: input.status,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(
          await generateId(),
          ['ProjectChangeRequest', 'Changeset'],
          secureProps
        )
      )
      .with('node')
      .match(node('project', 'Project', { id: input.projectId }))
      .create([
        node('project'),
        relation('out', '', 'changeset', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('node'),
      ])
      .return('node.id as id')
      .asResult<{ id: ID }>()
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
        relation('in', '', 'changeset', { active: true }),
        node('project', 'Project'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .match([
        node('project'),
        relation('out', '', 'status', { active: true }),
        node('projectStatus', 'Property'),
      ])
      .return([
        stripIndent`
          apoc.map.mergeList([
            props,
            {
              scope: scopedRoles,
              canEdit: projectStatus.value = "${ProjectStatus.Active}" and props.status = "${Status.Pending}"
            }
          ]) as dto`,
      ])
      .asResult<{
        dto: UnsecuredDto<ProjectChangeRequest>;
      }>();
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find project change request');
    }

    return result.dto;
  }

  list({ filter, ...input }: ProjectChangeRequestListInput, _session: Session) {
    return this.db
      .query()
      .match([
        // requestingUser(session),
        // ...permissionsOfNode(label),
        node('node', 'ProjectChangeRequest'),
        ...(filter.projectId
          ? [
              relation('in', '', 'changeset', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(ProjectChangeRequest, input));
  }
}
