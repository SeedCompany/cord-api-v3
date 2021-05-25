import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Order, Resource, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
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
import { BudgetRecord, BudgetRecordFilters, CreateBudgetRecord } from './dto';

@Injectable()
export class BudgetRecordRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(session: Session, secureProps: Property[]): Promise<Query> {
    const createBudgetRecord = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'BudgetRecord', secureProps))
      .return('node.id as id');
    return createBudgetRecord;
  }

  async connectToBudget(
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

  async verifyUniqueness(
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

  readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget'),
        relation('out', '', 'record', { active: true }),
        node('node', 'BudgetRecord', { id }),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return([
        'apoc.map.merge(props, { organization: organization.id }) as props',
        'scopedRoles',
      ])
      .asResult<{
        props: DbPropsOfDto<BudgetRecord, true>;
        scopedRoles: ScopedRole[];
      }>();

    return query;
  }

  getActualChanges(
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

  async updateProperties(
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

  async checkDeletePermission(id: ID, session: Session): Promise<boolean> {
    return await this.db.checkDeletePermission(id, session);
  }

  async deleteNode(node: BudgetRecord) {
    await this.db.deleteNode(node);
  }

  list(
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
}
