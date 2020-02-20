import {
  CreateBudgetInput,
  CreateBudgetInputDto,
  CreateBudgetOutputDto,
  DeleteBudgetInput,
  DeleteBudgetInputDto,
  DeleteBudgetOutputDto,
  ReadBudgetInput,
  ReadBudgetInputDto,
  ReadBudgetOutputDto,
  UpdateBudgetInput,
  UpdateBudgetInputDto,
  UpdateBudgetOutputDto,
} from './budget.dto';

import { Injectable } from '@nestjs/common';
import { generate } from 'shortid';
import { DatabaseService, ILogger, Logger, PropertyUpdaterService } from '../../core';
import { ISession } from '../auth';
@Injectable()
export class BudgetService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('BudgetService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async create(
    input: CreateBudgetInput, 
    { token }: ISession
  ): Promise<CreateBudgetOutputDto> {
    //TODO : Remove after verification
    // await session
    //   .run(
    //     'MERGE (budget:Budget {active: true, owningOrg: "seedcompany", id: $id}) ON CREATE SET budget.id = $id, budget.status  = $status, budget.timestamp = datetime() RETURN budget.id as id, budget.status as status, budget.budgetDetails as budgetDetails',
    //     {
    //       id,
    //       status: input.status,
    //       budgetDetails: input.budgetDetails,
    //     },
    //   )
    this.logger.info('create budget', { input, token });
    throw new Error('Not implemented');
  }

  async readOne(budgetId, { token }: ISession): Promise<ReadBudgetOutputDto> {
    //TODO : Remove after verification
    // await session
    //   .run(
    //     `MATCH (budget:Budget {active: true, owningOrg: "seedcompany"}) WHERE budget.id = "${input.id}" RETURN budget.id as id, budget.status as status`,
    //     {
    //       id: input.id,
    //     },
    //   )
    this.logger.info('find budget');
    throw new Error('Not implemented');
  }

  async update(input: UpdateBudgetInput, { token }: ISession): Promise<UpdateBudgetOutputDto> {
    //TODO : Remove after verification
    // await session
    //   .run(
    //     `MATCH (budget:Budget {active: true, owningOrg: "seedcompany", id: $id}) SET budget.status = $status  RETURN budget.id as id,budget.status as status`,
    //     {
    //       id: input.id,
    //       status: input.status,
    //     },
    //   )
    this.logger.info('update budget', { input, token });
    throw new Error('Not implemented');
  }

  async delete(id: string, { token }: ISession): Promise<void> {
    //TODO : Remove after verification
    // await session
    //   .run(
    //     'MATCH (budget:Budget {active: true, owningOrg: "seedcompany", id: $id}) SET budget.active = false RETURN budget.id as id',
    //     {
    //       id: input.id,
    //     },
    //   )
    this.logger.info('delete budget');
    throw new Error('Not implemented');
  }
}
