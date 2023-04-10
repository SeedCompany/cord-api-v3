import { Injectable } from '@nestjs/common';
import { ID, Order } from '../../common';
import { CreateOutcomeInput } from './dto/create-outome.dto';
import { OutcomeListInput } from './dto/list-outcome.dto';
import { OutcomesRepository } from './outcomes.repository';

@Injectable()
export class OutcomesService {
  constructor(private readonly repo: OutcomesRepository) {}

  async readOne(id: ID) {
    return await this.repo.readOne(id);
  }

  async create(input: CreateOutcomeInput) {
    const temp = await this.repo.create(input);
    return temp;
  }

  async listByEngagementId(engagement: ID, input?: OutcomeListInput) {
    let _input = input;
    if (!_input) {
      _input = {
        count: 100,
        order: Order.ASC,
        sort: 'createdAt',
        page: 1,
      };
    }
    return await this.repo.listByEngagementId(engagement, _input);
  }

  async listByReportId(report: ID, input?: OutcomeListInput) {
    let _input = input;
    if (!_input) {
      _input = {
        count: 100,
        order: Order.ASC,
        sort: 'createdAt',
        page: 1,
      };
    }
    return await this.repo.listByReportId(report, _input);
  }
}
