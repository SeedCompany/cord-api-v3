import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import {
  Session,
  ID,
  ServerException,
  generateId,
  Resource,
  Order,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { QueryWithResult } from '../../core/database/query.overrides';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { NativeDbProps } from '../../core/database/results/types';
import { Role } from '../authorization';
import { BaseNode } from '../file';
import {
  Budget,
  BudgetFilters,
  BudgetRecord,
  BudgetRecordFilters,
  BudgetStatus,
  CreateBudgetRecord,
  UpdateBudget,
} from './dto';

@Injectable()
export class BudgetRepository {
  constructor(private readonly db: DatabaseService) {}

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

  async connectBudget(
    budgetId: ID,
    organizationId: ID,
    result: Dictionary<any> | undefined,
    createdAt: DateTime
  ): Promise<Query> {
    // connect to budget
    const query = this.db
      .query()
      .match([node('budget', 'Budget', { id: budgetId })])
      .match([node('br', 'BudgetRecord', { id: result?.id })])
      .create([
        node('budget'),
        relation('out', '', 'record', { active: true, createdAt }),
        node('br'),
      ])
      .return('br');
    await query.first();

    // connect budget record to org
    const orgQuery = this.db
      .query()
      .match([
        node('organization', 'Organization', {
          id: organizationId,
        }),
      ])
      .match([node('br', 'BudgetRecord', { id: result?.id })])
      .create([
        node('br'),
        relation('out', '', 'organization', { active: true, createdAt }),
        node('organization'),
      ])
      .return('br');

    return orgQuery;
  }

  async existingRecord(
    input: CreateBudgetRecord
  ): Promise<Dictionary<any> | undefined> {
    const existingRecord = await this.db
      .query()
      .match([
        node('budget', 'Budget', { id: input.budgetId }),
        relation('out', '', 'record', { active: true }),
        node('br', 'BudgetRecord'),
        relation('out', '', 'organization', { active: true }),
        node('', 'Organization', { id: input.organizationId }),
      ])
      .match([
        node('br'),
        relation('out', '', 'fiscalYear', { active: true }),
        node('', 'Property', { value: input.fiscalYear }),
      ])
      .return('br')
      .first();
    return existingRecord;
  }

  async verifyRecordUniqueness(
    input: CreateBudgetRecord
  ): Promise<Dictionary<any> | undefined> {
    const existingRecord = await this.db
      .query()
      .match([
        node('budget', 'Budget', { id: input.budgetId }),
        relation('out', '', 'record', { active: true }),
        node('br', 'BudgetRecord'),
        relation('out', '', 'organization', { active: true }),
        node('', 'Organization', { id: input.organizationId }),
      ])
      .match([
        node('br'),
        relation('out', '', 'fiscalYear', { active: true }),
        node('', 'Property', { value: input.fiscalYear }),
      ])
      .return('br')
      .first();
    return existingRecord;
  }
  //vivek - what to replace promise<any> with
  readOne(
    id: ID,
    session: Session
  ): QueryWithResult<
    StandardReadResult<
      NativeDbProps<Omit<UnsecuredDto<Budget>, keyof BaseNode>>
    > & {
      memberRoles: Role[][];
    }
  > {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Budget', { id })])
      .apply(matchPropList)
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('node', 'Budget', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .apply(matchMemberRoles(session.userId))
      .return(['propList', 'node', 'memberRoles'])
      .asResult<
        StandardReadResult<DbPropsOfDto<Budget>> & {
          memberRoles: Role[][];
        }
      >();

    // const canDelete = await this.db.checkDeletePermission(id, session);

    return query;
  }
  //vivek - don't know how to assign the type
  readOneRecord(id: ID, session: Session): any {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'BudgetRecord', { id })])
      .apply(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget'),
        relation('out', '', 'record', { active: true }),
        node('node', 'BudgetRecord', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .apply(matchMemberRoles(session.userId))
      .match([
        node('node'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .with(['node', 'propList', 'organization', 'memberRoles'])
      .return([
        'propList + [{value: organization.id, property: "organization"}] as propList',
        'node',
        'memberRoles',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<BudgetRecord>> & {
          memberRoles: Role[][];
        }
      >();
    return query;
  }
  getActualChanges(budget: Budget, input: UpdateBudget) {
    return this.db.getActualChanges(Budget, budget, input);
  }

  async updateProperties(
    budget: Budget,
    simpleChanges: {
      status?: BudgetStatus | undefined;
    }
  ): Promise<Budget> {
    return await this.db.updateProperties({
      type: Budget,
      object: budget,
      changes: simpleChanges,
    });
  }

  getActualRecordChanges(
    br: BudgetRecord,
    input: {
      amount: number | null;
    }
  ): Partial<
    Omit<
      {
        amount: number | null;
      },
      keyof Resource
    >
  > {
    return this.db.getActualChanges(BudgetRecord, br, input);
  }

  async updateRecordProperties(
    br: BudgetRecord,
    changes: Partial<
      Omit<
        {
          amount: number | null;
        },
        keyof Resource
      >
    >
  ): Promise<BudgetRecord> {
    return await this.db.updateProperties({
      type: BudgetRecord,
      object: br,
      changes: changes,
    });
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

  async checkDeletePermission(id: ID, session: Session): Promise<boolean> {
    return await this.db.checkDeletePermission(id, session);
  }

  async deleteNode(node: Budget | BudgetRecord) {
    await this.db.deleteNode(node);
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
  listRecords(
    filter: BudgetRecordFilters,
    input: {
      sort: keyof BudgetRecord;
      order: Order;
      count: number;
      page: number;
    },
    session: Session
  ): QueryWithResult<{
    items: ID[];
    total: number;
  }> {
    const label = 'BudgetRecord';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.budgetId
          ? [
              relation('in', '', 'record', { active: true }),
              node('budget', 'Budget', {
                id: filter.budgetId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(BudgetRecord, input));
    return query;
  }

  async findBudgets(session: Session): Promise<Dictionary<any>[]> {
    const budgets = await this.db
      .query()
      .match([matchSession(session), [node('budget', 'Budget')]])
      .return('budget.id as id')
      .run();
    return budgets;
  }

  async budgetHasProperties(
    budget: Dictionary<any>,
    session: Session
  ): Promise<boolean> {
    return await this.db.hasProperties({
      session,
      id: budget.id,
      props: ['status'],
      nodevar: 'budget',
    });
  }

  async budgetIsUniqueProperties(
    budget: Dictionary<any>,
    session: Session
  ): Promise<boolean> {
    return await this.db.isUniqueProperties({
      session,
      id: budget.id,
      props: ['status'],
      nodevar: 'budget',
    });
  }
}
