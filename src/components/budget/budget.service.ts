import { Injectable, NotImplementedException } from '@nestjs/common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ISession } from '../auth';
import { Budget } from './budget';
import { CreateBudget, UpdateBudgetInput } from './dto';

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

  async update(_input: UpdateBudgetInput, _session: ISession): Promise<Budget> {
    throw new NotImplementedException();
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}
