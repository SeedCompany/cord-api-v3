import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, Order } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import { PartnershipService } from '../partnership/partnership.service';
import { ProjectService } from '../project/project.service';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  BudgetRecord,
  BudgetRecordListInput,
  BudgetRecordListOutput,
  BudgetStatus,
  CreateBudget,
  CreateBudgetRecord,
  UpdateBudget,
  UpdateBudgetRecord,
} from './dto';

import _ = require('lodash');

@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly partnershipService: PartnershipService,
    private readonly projectService: ProjectService,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    //const propLabel = 'Property';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (
    property: string,
    sg: string,
    baseNode: string,
    read: boolean,
    edit: boolean
  ) => {
    const createdAt = DateTime.local();
    return [
      [
        node(sg),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read,
          edit,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  async create(
    { projectId, ...input }: CreateBudget,
    session: ISession
  ): Promise<Budget> {
    this.logger.info('Creating Budget', input);
    if (!projectId) {
      throw new BadRequestException();
    }

    const id = generate();
    const createdAt = DateTime.local();
    const status: BudgetStatus = BudgetStatus.Pending;

    try {
      const createBudget = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateBudget' }))
        .create([
          [
            node('budget', 'Budget:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('status', status, 'budget'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: projectId + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('status', 'adminSG', 'budget', true, true),
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: projectId + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('status', 'readerSG', 'budget', true, false),
        ])
        .return('budget.id as id');

      await createBudget.first();

      this.logger.info(`Created Budget`, {
        id,
        userId: session.userId,
      });

      //connect budget to project
      const query = `
      MATCH
        (project:Project {id: $projectId, active: true}),
        (budget:Budget {id: $id, active: true})
      CREATE (project)-[:budget {active: true, createdAt: datetime()}]->(budget)
    `;
      await this.db
        .query()
        .raw(query, {
          projectId,
          id,
        })
        .first();

      // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
      const project = await this.projectService.readOne(projectId, session);
      const orgIds = (
        await this.partnershipService.list(
          {
            sort: 'createdAt',
            order: Order.ASC,
            count: 25,
            page: 1,
            filter: { projectId: project.id },
          },
          session
        )
      ).items.map((row) => row.organization.id);

      const mouStart = DateTime.fromISO(
        project.mouStart.value?.toString() || ''
      );
      const mouEnd = DateTime.fromISO(project.mouEnd.value?.toString() || '');

      const fiscalYearStart =
        mouStart.month >= 10 ? mouStart.year + 1 : mouStart.year;
      const fiscalYearEnd = mouEnd.month >= 10 ? mouEnd.year + 1 : mouEnd.year;
      await Promise.all(
        _.range(fiscalYearStart, fiscalYearEnd + 1).map((fiscalYear) => {
          orgIds.map((organizationId) =>
            this.createRecord(
              { budgetId: id, organizationId, fiscalYear },
              session
            )
          );
        })
      );
      const budget = await this.readOne(id, session);

      return budget;
    } catch {
      this.logger.error(`Could not create Budget`, {
        id,
        userId: session.userId,
      });
      throw new ServerException('Could not create Budget ');
    }
  }

  async readOne(id: string, session: ISession): Promise<Budget> {
    this.logger.info(`Query readOne Budget: `, {
      id,
      userId: session.userId,
    });

    const readBudget = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadBudgets' }))
      .match([node('budget', 'Budget', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadStatus', 'Permission', {
          property: 'status',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('budget'),
        relation('out', '', 'status', { active: true }),
        node('status', 'Property', { active: true }),
      ])
      .return({
        budget: [{ id: 'id', createdAt: 'createdAt' }],
        status: [{ value: 'status' }],
        requestingUser: [
          {
            canReadBudgets: 'canReadBudgets',
            canCreateBudget: 'canCreateBudget',
          },
        ],
        canReadStatus: [{ read: 'canReadStatus', edit: 'canEditStatus' }],
      });

    let result;
    try {
      result = await readBudget.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }

    if (!result) {
      this.logger.error(`Could not find budget:  `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException('Could not find budget');
    }

    // get budgetRecordIds
    const brs = await this.listRecords(
      {
        sort: 'fiscalYear',
        order: Order.ASC,
        page: 1,
        count: 25,
        filter: { budgetId: id },
      },
      session
    );

    let records;
    if (brs.items) {
      records = brs.items.map((row: any) => {
        return { value: row.id, canRead: true, canEdit: true };
      });
    }
    const budget = {
      id: result.id,
      createdAt: result.createdAt,
      status: result.canReadStatus ? result.status : undefined,
      records,
    };

    return budget;
  }

  async list(
    { page, count, sort, order, filter }: BudgetListInput,
    session: ISession
  ): Promise<BudgetListOutput> {
    const { projectId } = filter;
    this.logger.info('Listing budgets on projectId ', {
      projectId,
      userId: session.userId,
    });

    const query = `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        }),
        (project:Project {id: $projectId, active: true, owningOrgId: $owningOrgId})
        -[:budget]->(budget:Budget {active:true})
      WITH COUNT(budget) as total, project, budget
          MATCH (budget {active: true})-[:status {active:true }]->(status:Property {active: true})
          RETURN total, budget.id as budgetId, status.value as status
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count
      `;
    const projBudgets = await this.db
      .query()
      .raw(query, {
        token: session.token,
        requestingUserId: session.userId,
        owningOrgId: session.owningOrgId,
        projectId,
        skip: (page - 1) * count,
        count,
      })
      .run();

    const items = await Promise.all(
      projBudgets.map(async (budget) => this.readOne(budget.budgetId, session))
    );

    return {
      items: items,
      hasMore: false, // TODO
      total: items.length,
    };
  }

  async update(input: UpdateBudget, session: ISession): Promise<Budget> {
    const budget = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: budget,
      props: ['status'],
      changes: input,
      nodevar: 'budget',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const budget = await this.readOne(id, session);

    // cascade delete each budget record in this budget
    if (budget.records) {
      await Promise.all(
        budget.records.map(async (br) => {
          if (br.value) {
            await this.deleteRecord(br.value, session);
          }
        })
      );
    }
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    await this.db.deleteNode({
      session,
      object: budget,
      aclEditProp: 'canCreateBudget',
    });
  }

  async createRecord(
    { budgetId, organizationId, ...input }: CreateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
    if (!input.fiscalYear || !organizationId) {
      throw new BadRequestException();
    }

    this.logger.info('Creating BudgetRecord', input);
    // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
    const id = generate();
    const createdAt = DateTime.local();

    try {
      // await this.db.createNode({
      //   session,
      //   input: { id, ...input, amount: 0 }, // on init the amount is 0
      //   acls,
      //   type: BudgetRecord.classType,
      // });
      const createBudgetRecord = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateBudget' }))
        .create([
          [
            node('budgetRecord', 'BudgetRecord:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('fiscalYear', input.fiscalYear, 'budgetRecord'),
          ...this.property('amount', '0', 'budgetRecord'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.fiscalYear.toString() + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.fiscalYear.toString() + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission(
            'fiscalYear',
            'adminSG',
            'budgetRecord',
            true,
            true
          ),
          ...this.permission(
            'fiscalYear',
            'readerSG',
            'budgetRecord',
            true,
            false
          ),
          ...this.permission('amount', 'adminSG', 'budgetRecord', true, true),
          ...this.permission('amount', 'readerSG', 'budgetRecord', true, false),
          ...this.permission(
            'organization',
            'adminSG',
            'budgetRecord',
            true,
            true
          ),
          ...this.permission(
            'organization',
            'readerSG',
            'budgetRecord',
            true,
            false
          ),
        ])
        .return('budgetRecord.id as id');

      await createBudgetRecord.first();

      this.logger.info(`Created Budget Record`, {
        id,
        userId: session.userId,
      });

      // connect to budget
      const query = `
      MATCH
        (budget:Budget {id: $budgetId, active: true}),
        (br:BudgetRecord {id: $id, active: true})
      CREATE (budget)-[:record {active: true, createdAt: datetime()}]->(br)
    `;
      await this.db
        .query()
        .raw(query, {
          budgetId,
          id,
        })
        .first();

      // connect budget record to org
      const orgQuery = `
        MATCH
        (organization:Organization {id: $organizationId, active: true}),
        (br:BudgetRecord {id: $id, active: true})
      CREATE (br)-[:organization {active: true, createdAt: datetime()}]->(organization)
`;
      await this.db
        .query()
        .raw(orgQuery, {
          organizationId,
          id,
        })
        .first();

      const result = await this.readOneRecord(id, session);

      return result;
    } catch (exception) {
      this.logger.error(`Could not create Budget Record`, {
        id,
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not create Budget Record');
    }
  }

  async readOneRecord(id: string, session: ISession): Promise<BudgetRecord> {
    this.logger.info(`Query readOne Budget Record: `, {
      id,
      userId: session.userId,
    });

    const readBudgetRecord = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadBudgets' }))
      .match([node('budgetRecord', 'BudgetRecord', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadAmount', 'Permission', {
          property: 'amount',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('budgetRecord'),
        relation('out', '', 'amount', { active: true }),
        node('amount', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadFiscalYear', 'Permission', {
          property: 'fiscalYear',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('budgetRecord'),
        relation('out', '', 'fiscalYear', { active: true }),
        node('fiscalYear', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadOrganization', 'Permission', {
          property: 'organization',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('budgetRecord'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization', { active: true }),
      ])
      .return({
        budgetRecord: [{ id: 'id', createdAt: 'createdAt' }],
        amount: [{ value: 'amount' }],
        canReadAmount: [
          { read: 'canReadAmountRead', edit: 'canReadAmountEdit' },
        ],
        fiscalYear: [{ value: 'fiscalYear' }],
        canReadFiscalYear: [
          { read: 'canReadFiscalYearRead', edit: 'canReadFiscalYearEdit' },
        ],
        organization: [{ id: 'organizationId' }],
        canReadOrganization: [
          {
            read: 'canReadOrganizationRead',
            edit: 'canReadOrganizationEdit',
          },
        ],
      });

    let result;
    try {
      result = await readBudgetRecord.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }

    if (!result) {
      this.logger.error(`Could not find budgetRecord:  `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException('Could not find budgetRecord');
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      organizationId: {
        value: result.organizationId,
        canRead: result.canReadOrganizationRead,
        canEdit: result.canReadOrganizationEdit,
      },
      fiscalYear: {
        value: result.fiscalYear,
        canRead: result.canReadFiscalYearRead,
        canEdit: result.canReadFiscalYearEdit,
      },
      amount: {
        value: result.amount,
        canRead: result.canReadAmountRead,
        canEdit: result.canReadAmountEdit,
      },
    };
  }

  async listRecords(
    { page, count, sort, order, filter }: BudgetRecordListInput,
    session: ISession
  ): Promise<BudgetRecordListOutput> {
    const { budgetId } = filter;
    this.logger.info('Listing budget records on budgetId ', {
      budgetId,
      userId: session.userId,
    });

    const query = `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        }),
        (budget:Budget {id: $budgetId, active: true, owningOrgId: $owningOrgId})
        -[:record]->(budgetRecord:BudgetRecord {active:true})
      WITH COUNT(budgetRecord) as total, budgetRecord
          MATCH (budgetRecord {active: true})-[:amount {active:true }]->(amount:Property {active: true}),
          (budgetRecord)-[:organization { active: true }]->(org:Organization {active:true}),
          (budgetRecord)-[:fiscalYear {active: true}]->(fiscalYear {active: true})
          RETURN total, budgetRecord.id as budgetRecordId, fiscalYear.value as fiscalYear, org.id as orgId
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count
      `;
    const brs = await this.db
      .query()
      .raw(query, {
        token: session.token,
        requestingUserId: session.userId,
        owningOrgId: session.owningOrgId,
        budgetId,
        skip: (page - 1) * count,
        count,
      })
      .run();

    const items = await Promise.all(
      brs.map(async (br) => this.readOneRecord(br.budgetRecordId, session))
    );

    return {
      items: items,
      hasMore: false, // TODO
      total: items.length,
    };
  }

  async updateRecord(
    { id, ...input }: UpdateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
    this.logger.info('Update budget Record, ', { id, userId: session.userId });

    const br = await this.readOneRecord(id, session);

    try {
      const result = await this.db.sgUpdateProperties({
        session,
        object: br,
        props: ['amount'],
        changes: { id, ...input },
        nodevar: 'budgetRecord',
      });
      return result;
    } catch (e) {
      this.logger.error('Could not update budget Record ', {
        id,
        userId: session.userId,
      });
      throw e;
    }
  }

  async deleteRecord(id: string, session: ISession): Promise<void> {
    const br = await this.readOneRecord(id, session);
    if (!br) {
      throw new NotFoundException('Budget Record not found');
    }

    await this.db.deleteNode({
      session,
      object: br,
      aclEditProp: 'canCreateBudget',
    });
  }

  async checkBudgetConsistency(session: ISession): Promise<boolean> {
    const budgets = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('budget', 'Budget', {
            active: true,
          }),
        ],
      ])
      .return('budget.id as id')
      .run();

    return (
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return this.db.hasProperties({
              session,
              id: budget.id,
              props: ['status'],
              nodevar: 'budget',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return this.db.isUniqueProperties({
              session,
              id: budget.id,
              props: ['status'],
              nodevar: 'budget',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
