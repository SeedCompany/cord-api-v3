import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Order, ServerException, Session } from '../../common';
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
import { QueryWithResult } from '../../core/database/query.overrides';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import { Budget, BudgetFilters, BudgetStatus } from './dto';

@Injectable()
export class BudgetRepository extends DtoRepository(Budget) {
  readProject(projectId: ID, session: Session): Query {
    const readProject = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .match([node('project', 'Project', { id: projectId })]);
    readProject.return({
      project: [{ id: 'id', createdAt: 'createdAt' }],
      requestingUser: [
        {
          canReadProjects: 'canReadProjects',
          canCreateProject: 'canCreateProject',
        },
      ],
    });
    return readProject;
  }

  async createBudget(
    projectId: ID,
    budgetId: ID,
    secureProps: Property[],
    session: Session
  ): Promise<Dictionary<any> | undefined> {
    const createBudget = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(budgetId, 'Budget', secureProps))
      .return('node.id as id');
    const result = await createBudget.first();
    if (!result) {
      throw new ServerException('failed to create a budget');
    }
    // connect budget to project
    await this.db
      .query()
      .matchNode('project', 'Project', { id: projectId })
      .matchNode('budget', 'Budget', { id: result.id })
      .create([
        node('project'),
        relation('out', '', 'budget', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('budget'),
      ])
      .run();
    return result;
  }

  async createBudgetRecord(
    session: Session,
    secureProps: Property[]
  ): Promise<Query> {
    const createBudgetRecord = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'BudgetRecord', secureProps))
      .return('node.id as id');
    return createBudgetRecord;
  }

  readOne(id: ID, session: Session) {
    const query = this.db
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
      }>();

    return query;
  }

  async verifyCanEdit(
    id: ID
  ): Promise<
    | {
        status: BudgetStatus;
      }
    | undefined
  > {
    return await this.db
      .query()
      .match([
        node('budgetRecord', 'BudgetRecord', { id }),
        relation('in', '', 'record', { active: true }),
        node('budget', 'Budget'),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property'),
      ])
      .return('status.value as status')
      .asResult<{ status: BudgetStatus }>()
      .first();
  }

  list(
    filter: BudgetFilters,
    listInput: {
      sort: keyof Budget;
      order: Order;
      count: number;
      page: number;
    },
    session: Session
  ): QueryWithResult<{
    items: ID[];
    total: number;
  }> {
    const label = 'Budget';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'budget', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Budget, listInput));
    return query;
  }
}
