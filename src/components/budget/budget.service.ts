import { Injectable, NotImplementedException } from '@nestjs/common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ISession } from '../auth';
import { Budget } from './budget';
import {
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

  async delete(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedException();
  }

  async createRecord(
    input: CreateBudgetRecord,
    _session: ISession
  ): Promise<BudgetRecord> {
    this.logger.info('Creating BudgetRecord', input);
    throw new NotImplementedException();
    // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
  }

  async readOneRecord(
    _langId: string,
    _session: ISession
  ): Promise<BudgetRecord> {
    throw new NotImplementedException();
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

  async deleteRecord(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
