import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Order, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Role } from '../authorization';
import { Partnership, PartnershipFilters, UpdatePartnership } from './dto';

@Injectable()
export class PartnershipRepository {
  constructor(private readonly db: DatabaseService) {}

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
      .apply(matchRequestingUser(session))
      .match([node('node', 'Partnership', { id })])
      .apply(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'partnership', { active: true }),
        node('', 'Partnership', { id: id }),
      ])
      .with(['project', 'node', 'propList'])
      .apply(matchMemberRoles(session.userId))
      .match([
        node('node'),
        relation('in', '', 'partnership'),
        node('project', 'Project'),
      ])
      .match([
        node('node'),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
      ])
      .return(
        'propList, memberRoles, node, project.id as projectId, partner.id as partnerId'
      )
      .asResult<
        StandardReadResult<DbPropsOfDto<Partnership>> & {
          projectId: ID;
          partnerId: ID;
          memberRoles: Role[][];
        }
      >();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(object: Partnership, input: UpdatePartnership) {
    return this.db.getActualChanges(Partnership, object, input);
  }

  async updateProperties(object: Partnership, changes: DbChanges<Partnership>) {
    await this.db.updateProperties({
      type: Partnership,
      object,
      changes,
    });
  }

  async deleteNode(node: Partnership) {
    await this.db.deleteNode(node);
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

  async getPartnerships(session: Session) {
    return await this.db
      .query()
      .match([matchSession(session), [node('partnership', 'Partnership')]])
      .return('partnership.id as id')
      .run();
  }

  async hasProperties(id: ID, session: Session) {
    return await this.db.hasProperties({
      session,
      id,
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      nodevar: 'partnership',
    });
  }

  async isUniqueProperties(id: ID, session: Session) {
    return await this.db.isUniqueProperties({
      session,
      id,
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      nodevar: 'partnership',
    });
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
