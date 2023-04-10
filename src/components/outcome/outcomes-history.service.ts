import { Injectable } from '@nestjs/common';
import { ID, Order } from '../../common';
import { OutcomeHistoryListInput } from './dto/list-outcomes-history.dto';
import { UpdateOutcomeHistoryInput } from './dto/update-outcome-history.dto';
import { OutcomesHistoryRepository } from './outcomes-history.repository';

@Injectable()
export class OutcomesHistoryService {
  constructor(private readonly repo: OutcomesHistoryRepository) {}

  async listByReportId(report: ID, input?: OutcomeHistoryListInput) {
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

  async updateOutcomeHistory(input: UpdateOutcomeHistoryInput) {
    return await this.repo.update(input);
  }

  async readByOutcomeId(outcomeId: ID) {
    return await this.repo.readByOutcomeId(outcomeId);
  }
}
