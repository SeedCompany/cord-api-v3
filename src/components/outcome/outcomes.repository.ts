import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DtoRepository } from '~/core';
import { ID } from '../../common';
import {
  ACTIVE,
  createNode,
  createRelationships,
  paginate,
  sorting,
} from '../../core/database/query';
import { Outcome, OutcomeHistory } from './dto';
import { CreateOutcomeInput } from './dto/create-outome.dto';
import { OutcomeListInput } from './dto/list-outcome.dto';

@Injectable()
export class OutcomesRepository extends DtoRepository(Outcome) {
  async create(input: CreateOutcomeInput) {
    const initialProps = {
      createdAt: DateTime.local(),
      modifiedAt: DateTime.local(),
      description: input.description,
    };
    const createdOutcome = await this.db
      .query()
      .logIt()
      .apply(await createNode(Outcome, { initialProps }))
      .apply(
        createRelationships(Outcome, {
          out: { engagement: ['Engagement', input.engagement] },
        }),
      )
      .return<Outcome>('node')
      .first();

    if (createdOutcome) {
      await this.db
        .query()
        .logIt()
        .match([node('history', 'Outcome', { id: createdOutcome.id })])
        .apply(await createNode(OutcomeHistory, { initialProps: {} }))
        .apply(
          createRelationships(OutcomeHistory, {
            out: { outcome: ['Outcome', createdOutcome.id] },
          }),
        )
        .return('history')
        .first();
    }
    return createdOutcome;
  }

  async listByEngagementId(engagement: ID, input: OutcomeListInput) {
    const result = await this.db
      .query()
      .logIt()
      .match([
        node('node', 'Outcome'),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement', 'LanguageEngagement', { id: engagement }),
      ])
      .apply(sorting(Outcome, input))
      .apply(paginate(input, this.hydrate()))
      .first();

    return result!;
  }

  async listByReportId(report: ID, input: OutcomeListInput) {
    const result = await this.db
      .query()
      .logIt()
      .match([
        node('node', 'Outcome'),
        relation('out', '', 'report', ACTIVE),
        node('report', 'Report', { id: report }),
      ])
      .apply(sorting(Outcome, input))
      .apply(paginate(input, this.hydrate()))
      .first();

    return result!;
  }
}
