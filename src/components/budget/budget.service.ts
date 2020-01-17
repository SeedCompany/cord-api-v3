import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateBudgetInput,
  CreateBudgetInputDto,
  CreateBudgetOutputDto,
  ReadBudgetInputDto,
  ReadBudgetInput,
  ReadBudgetOutputDto,
  UpdateBudgetInput,
  UpdateBudgetInputDto,
  UpdateBudgetOutputDto,
  DeleteBudgetInput,
  DeleteBudgetInputDto,
  DeleteBudgetOutputDto,
} from './budget.dto';
@Injectable()
export class BudgetService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateBudgetInput): Promise<CreateBudgetOutputDto> {
    const response = new CreateBudgetOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (budget:Budget {active: true, owningOrg: "seedcompany", status: $status}) ON CREATE SET budget.id = $id, budget.timestamp = datetime() RETURN budget.id as id, budget.status as status, budget.budgetDetails as budgetDetails',
        {
          id,
          status: input.status,
          budgetDetails: input.budgetDetails,
        },
      )
      .then(result => {
        response.budget.id = result.records[0].get('id');
        response.budget.status = result.records[0].get('status');
        response.budget.budgetDetails = result.records[0].get('budgetDetails');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
  async readOne(input: ReadBudgetInput): Promise<ReadBudgetOutputDto> {
    const response = new ReadBudgetOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (budget:Budget {active: true, owningOrg: "seedcompany"}) WHERE budget.id = "${input.id}" RETURN budget.id as id, budget.status as status`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.budget.id = result.records[0].get('id');
        response.budget.status = result.records[0].get('status');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateBudgetInput): Promise<UpdateBudgetOutputDto> {
    const response = new UpdateBudgetOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (budget:Budget {active: true, owningOrg: "seedcompany", id: $id}) SET budget.status = $status  RETURN budget.id as id,budget.status as status`,
        {
          id: input.id,
          status: input.status,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.budget.id = result.records[0].get('id');
          response.budget.status = result.records[0].get('status');
        } else {
          response.budget = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteBudgetInput): Promise<DeleteBudgetOutputDto> {
    const response = new DeleteBudgetOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (budget:Budget {active: true, owningOrg: "seedcompany", id: $id}) SET budget.active = false RETURN budget.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.budget.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
