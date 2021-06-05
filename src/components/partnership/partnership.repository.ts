import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Order, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import { Partnership, PartnershipFilters } from './dto';

@Injectable()
export class PartnershipRepository extends DtoRepository(Partnership) {
  create(partnershipId: ID, session: Session, secureProps: Property[]) {
    return this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(partnershipId, 'Partnership', secureProps))
      .return('node.id as id');
  }
  // connect the Partner to the Partnership
  // and connect Partnership to Project

  async connect(
    projectId: ID,
    partnerId: ID,
    createdAt: DateTime,
    result: Dictionary<any>
  ) {
    await this.db
      .query()
      .match([
        [
          node('partner', 'Partner', {
            id: partnerId,
          }),
        ],
        [
          node('partnership', 'Partnership', {
            id: result.id,
          }),
        ],
        [node('project', 'Project', { id: projectId })],
      ])
      .create([
        node('project'),
        relation('out', '', 'partnership', { active: true, createdAt }),
        node('partnership'),
        relation('out', '', 'partner', { active: true, createdAt }),
        node('partner'),
      ])
      .return('partnership.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'partnership', { active: true }),
        node('node', 'Partnership', { id }),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return([
        'props',
        'scopedRoles',
        'project.id as projectId',
        'partner.id as partnerId',
      ])
      .asResult<{
        props: DbPropsOfDto<Partnership, true>;
        projectId: ID;
        partnerId: ID;
        scopedRoles: ScopedRole[];
      }>();

    return await query.first();
  }

  list(
    filter: PartnershipFilters,
    listInput: {
      sort: keyof Partnership;
      order: Order;
      count: number;
      page: number;
    },
    session: Session
  ) {
    const label = 'Partnership';

    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'partnership', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Partnership, listInput));
  }

  async verifyRelationshipEligibility(projectId: ID, partnerId: ID) {
    return await this.db
      .query()
      .optionalMatch(node('partner', 'Partner', { id: partnerId }))
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch([
        node('project'),
        relation('out', '', 'partnership', { active: true }),
        node('partnership'),
        relation('out', '', 'partner', { active: true }),
        node('partner'),
      ])
      .return(['partner', 'project', 'partnership'])
      .asResult<{ partner?: Node; project?: Node; partnership?: Node }>()
      .first();
  }

  async isFirstPartnership(projectId: ID) {
    return await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'partnership', { active: true }),
        node('partnership'),
      ])
      .return(['partnership'])
      .asResult<{ partnership?: Node }>()
      .first();
  }

  otherPartnershipQuery(partnershipId: ID) {
    return this.db
      .query()
      .match([
        node('partnership', 'Partnership', { id: partnershipId }),
        relation('in', '', 'partnership', { active: true }),
        node('project', 'Project'),
        relation('out', '', 'partnership', { active: true }),
        node('otherPartnership'),
      ])
      .raw('WHERE partnership <> otherPartnership')
      .with('otherPartnership');
  }
}
