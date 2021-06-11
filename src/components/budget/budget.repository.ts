import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, NotFoundException, ServerException, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  matchSession,
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
import { Budget, BudgetListInput, BudgetStatus } from './dto';

@Injectable()
export class BudgetRepository extends DtoRepository(Budget) {
  async doesProjectExist(projectId: ID, session: Session) {
    const result = await this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { id: projectId })])
      .return('project.id')
      .first();
    return !!result;
  }

  async create(budgetId: ID, secureProps: Property[], session: Session) {
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(budgetId, 'Budget', secureProps))
      .return('node.id as id')
      .asResult<{ id: ID }>()
      .first();
    if (!result) {
      throw new ServerException('Failed to create budget');
    }
  }

  async connectToProject(budgetId: ID, projectId: ID) {
    await this.db
      .query()
      .matchNode('project', 'Project', { id: projectId })
      .matchNode('budget', 'Budget', { id: budgetId })
      .create([
        node('project'),
        relation('out', '', 'budget', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('budget'),
      ])
      .run();
  }

  async readOne(id: ID, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('node', 'Budget', { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return(['props', 'scopedRoles'])
      .asResult<{
        props: DbPropsOfDto<Budget, true>;
        scopedRoles: ScopedRole[];
      }>()
      .first();
    if (!result) {
      throw new NotFoundException('Could not find budget', 'budget.id');
    }

    return result;
  }

  async getStatusByRecord(recordId: ID) {
    const result = await this.db
      .query()
      .match([
        node('budgetRecord', 'BudgetRecord', { id: recordId }),
        relation('in', '', 'record', { active: true }),
        node('budget', 'Budget'),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property'),
      ])
      .return('status.value as status')
      .asResult<{ status: BudgetStatus }>()
      .first();
    if (!result) {
      throw new NotFoundException('Budget could not be found');
    }
    return result.status;
  }

  list({ filter, ...input }: BudgetListInput, session: Session) {
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Budget'),
        ...(filter.projectId
          ? [
              relation('in', '', 'budget', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Budget, input));
    return query;
  }
}
