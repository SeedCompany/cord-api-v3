import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
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

@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly projectService: ProjectService,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  async create(
    { projectId, ...input }: CreateBudget,
    session: ISession
  ): Promise<Budget> {
    this.logger.info('Creating Budget', input);
    if (!projectId) {
      throw new BadRequestException();
    }

    const id = generate();
    const status: BudgetStatus = BudgetStatus.Pending;
    const acls = {
      canEditStatus: true,
      canEditRecords: true,
      canReadStatus: true,
      canReadRecords: true,
    };

    try {
      await this.db.createNode({
        session,
        input: { id, status, ...input },
        acls,
        type: Budget.classType,
      });

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
      const _project = await this.projectService.readOne(projectId, session);

      const result = await this.readOne(id, session);

      return result;
    } catch {
      this.logger.error(`Could not create Budget`, {
        id,
        userId: session.userId,
      });
      throw new Error('Could not create Budget ');
    }
  }

  async readOne(id: string, session: ISession): Promise<Budget> {
    this.logger.info(`Query readOne Budget: `, {
      id,
      userId: session.userId,
    });

    const result = await this.db.readProperties({
      session,
      id,
      props: ['id', 'createdAt', 'status'],
      nodevar: 'budget',
    });

    if (!result) {
      this.logger.error(`Could not find budget:  `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException('Could not find budget');
    }

    return {
      id: result.id.value,
      createdAt: result.createdAt.value,
      status: result.status.value,
    };
  }

  async list(
    { page, count, sort, order, filter }: BudgetListInput,
    session: ISession
  ): Promise<BudgetListOutput> {
    const { projectId, ...rest } = filter;
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
        -[:budget]->(budget:Budget {active:true})-[:status]->(status:Property)
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
      projBudgets.map(async budget => this.readOne(budget.budgetId, session))
    );

    const result = await this.db.list<Budget>({
      session,
      nodevar: 'budget',
      aclReadProp: 'canReadBudgetList',
      aclEditProp: 'canCreateBudget',
      props: ['status'],
      input: {
        page,
        count,
        sort,
        order,
        filter: rest,
      },
    });

    return {
      items: items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async update(input: UpdateBudget, session: ISession): Promise<Budget> {
    const budget = await this.readOne(input.id, session);

    return this.db.updateProperties({
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
        budget.records.map(async br => {
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
    const acls = {
      canEditAmount: true,
      canEditFiscalYear: true,
      canEditOrganizationId: true,
      canReadAmount: true,
      canReadFiscalYear: true,
      canReadOrganizationId: true,
    };

    try {
      await this.db.createNode({
        session,
        input: { id, ...input, amount: 0 }, // on init the amount is 0
        acls,
        type: BudgetRecord.classType,
      });

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
    } catch {
      this.logger.error(`Could not create Budget Record`, {
        id,
        userId: session.userId,
      });
      throw new Error('Could not create Budget Record');
    }
  }

  async readOneRecord(id: string, session: ISession): Promise<BudgetRecord> {
    this.logger.info(`Query readOne Budget Record: `, {
      id,
      userId: session.userId,
    });

    const result = await this.db.readProperties({
      session,
      id,
      props: ['id', 'createdAt', 'fiscalYear', 'amount'],
      nodevar: 'budgetRecord',
    });

    if (!result) {
      this.logger.error(`Could not find budgetRecord:  `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException('Could not find budgetRecord');
    }

    // get orgId
    const query = `
    MATCH
      (acl:ACL)-[:toNode]->(br: BudgetRecord {id: $id, active: true})
      -[:organization {active: true}]->(org:Organization {active: true})
    RETURN
      org, acl
    `;
    const orgResult = await this.db
      .query()
      .raw(query, {
        id,
      })
      .first();
    if (!orgResult) {
      this.logger.error(`Could not find organization on budgetRecord: `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException(
        'Could not find organization on budgetRecord'
      );
    }

    return {
      ...result,
      id: result.id.value,
      createdAt: result.createdAt.value,
      organizationId: {
        value: orgResult?.org.properties.id,
        canRead: orgResult?.acl.properties.canReadOrganizationId,
        canEdit: orgResult?.acl.properties.canEditOrganizationId,
      },
    };
  }

  async listRecords(
    { page, count, sort, order, filter }: BudgetRecordListInput,
    session: ISession
  ): Promise<BudgetRecordListOutput> {
    const result = await this.db.list<BudgetRecord>({
      session,
      nodevar: 'budgetRecord',
      aclReadProp: 'canReadBudgetRecordList',
      aclEditProp: 'canCreateBudgetRecord',
      props: ['fiscalYear', 'amount'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async updateRecord(
    { id, ...input }: UpdateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
    this.logger.info('Update budget Record, ', { id, userId: session.userId });

    const br = await this.readOneRecord(id, session);

    try {
      const result = await this.db.updateProperties({
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
}
