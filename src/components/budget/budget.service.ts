import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { generate } from 'shortid';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ISession } from '../auth';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  BudgetRecord,
  BudgetRecordListInput,
  BudgetRecordListOutput,
  CreateBudget,
  CreateBudgetRecord,
  UpdateBudget,
  UpdateBudgetRecord,
} from './dto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DatabaseService,

    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateBudget, _session: ISession): Promise<Budget> {
    this.logger.info('Creating Budget', input);
    throw new NotImplementedException();
    // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
  }

  async readOne(_langId: string, _session: ISession): Promise<Budget> {
    throw new NotImplementedException();
  }

  async list(
    _input: BudgetListInput,
    _session: ISession
  ): Promise<BudgetListOutput> {
    throw new NotImplementedException();
  }

  async update(_input: UpdateBudget, _session: ISession): Promise<Budget> {
    throw new NotImplementedException();
  }

  async delete(id: string, session: ISession): Promise<void> {
    const budget = await this.readOne(id, session);

    // cascade delete each budget record in this budget
    await Promise.all(
      budget.records.map(async br => {
        if (br.value) {
          await this.deleteRecord(br.value, session);
        }
      })
    );
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    await this.db.deleteNode({
      session,
      object: budget,
      aclEditProp: 'canEditBudget',
    });
  }

  async createRecord(
    { budgetId, ...input }: CreateBudgetRecord,
    session: ISession
  ): Promise<BudgetRecord> {
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
        input: { id, ...input },
        acls,
        baseNodeLabel: 'BudgetRecord',
        aclEditProp: 'canCreateBudgetRecord',
      });

      this.logger.info(`Created user Budget Record`, {
        id,
        userId: session.userId,
      });

      //connect to budget
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
      const result = await this.readOneRecord(id, session);
      return result;
    } catch {
      this.logger.error(`Could not create BudgetRecord`, {
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
      props: ['id', 'createdAt', 'organizationId', 'fiscalYear', 'amount'],
      nodevar: 'budgetRecord',
    });

    if (!result) {
      this.logger.error(`Could not find budgetRecord:  `, {
        id,
        userId: session.userId,
      });
      throw new NotFoundException('Could not find language');
    }

    let br = result as any;
    br.organizationId = result.organizationId.value;
    br.fiscalYear = result.fiscalYear.value;
    br.amount = result.amount.value;
    br = br as BudgetRecord;

    return br;
  }

  async listRecords(
    _input: BudgetRecordListInput,
    _session: ISession
  ): Promise<BudgetRecordListOutput> {
    throw new NotImplementedException();
  }

  async updateRecord(
    _input: UpdateBudgetRecord,
    _session: ISession
  ): Promise<BudgetRecord> {
    throw new NotImplementedException();
  }

  async deleteRecord(id: string, session: ISession): Promise<void> {
    const br = await this.readOne(id, session);
    if (!br) {
      throw new NotFoundException('Budget Record not found');
    }
    await this.db.deleteNode({
      session,
      object: br,
      aclEditProp: 'canEditBudget',
    });
  }
}
