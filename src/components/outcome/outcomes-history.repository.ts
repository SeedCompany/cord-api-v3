import { node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { DtoRepository } from '../../core';
import { ACTIVE, paginate, sorting } from '../../core/database/query';
import { OutcomeHistory } from './dto';
import { OutcomeHistoryListInput } from './dto/list-outcomes-history.dto';
import { UpdateOutcomeHistoryInput } from './dto/update-outcome-history.dto';

export class OutcomesHistoryRepository extends DtoRepository(OutcomeHistory) {
  async readByOutcomeId(outcome: ID) {
    return await this.db
      .query()
      .logIt()
      .match([
        node('node', 'OutcomeHistory'),
        relation('out', '', 'outcome', ACTIVE),
        node('outcome', 'Outcome', { id: outcome }),
      ])
      .return<OutcomeHistory>('node')
      .first();
  }

  async listByReportId(report: ID, input: OutcomeHistoryListInput) {
    const result = await this.db
      .query()
      .logIt()
      .match([
        node('node', 'OutcomeHistory'),
        relation('out', '', 'report', ACTIVE),
        node('report', 'Report', { id: report }),
      ])
      .apply(sorting(OutcomeHistory, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result;
  }

  async update(input: UpdateOutcomeHistoryInput) {
    // check if the outcome history exists on the input.report
    const outcomeHistory = await this.db
      .query()
      .logIt()
      .match([
        node('node', 'OutcomeHistory', { id: input.id }),
        relation('out', '', 'report', ACTIVE),
        node('report', 'Report', { id: input.report }),
      ])
      .return<OutcomeHistory>('node')
      .first();

    if (!outcomeHistory) {
      // create the relation
      return await this.db
        .query()
        .match([
          node('node', 'OutcomeHistory', { id: input.id }),
          node('report', 'Report', { id: input.report }),
        ])
        .create([
          node('node'),
          relation('out', '', 'report', ACTIVE),
          node('report'),
        ])
        .return<OutcomeHistory>('node')
        .first();
    } else {
      // update the outcome history
      return await this.db
        .query()
        .logIt()
        .matchNode('node', 'OutcomeHistory', { id: input.id })
        .merge([
          node('node'),
          relation('out', '', 'report', ACTIVE),
          node('report', 'Report', { id: input.report }),
        ])
        .setValues({
          node: {
            status: input.status,
          },
        })
        .return<OutcomeHistory>('node')
        .first();
    }
  }
}
