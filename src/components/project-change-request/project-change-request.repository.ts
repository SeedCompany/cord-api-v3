import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ProjectStatus } from '../project';
import { ScopedRole } from '../project/project-member';
import { ProjectChangeRequest, ProjectChangeRequestListInput } from './dto';

@Injectable()
export class ProjectChangeRequestRepository extends DtoRepository(
  ProjectChangeRequest
) {
  async create(session: Session, secureProps: Property[]) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(
          await generateId(),
          ['ProjectChangeRequest', 'Changeset'],
          secureProps
        )
      )
      .return('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
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
      .return(['props', 'scopedRoles', 'projectStatus'])
      .asResult<{
        props: DbPropsOfDto<ProjectChangeRequest, true>;
        scopedRoles: ScopedRole[];
        projectStatus: ProjectStatus;
      }>();

    return await query.first();
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
