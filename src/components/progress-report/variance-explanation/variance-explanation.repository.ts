import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  ExpressionInput,
  matchProps,
  merge,
  updateProperties,
} from '~/core/database/query';
import {
  ProgressReportVarianceExplanation as VarianceExplanation,
  ProgressReportVarianceExplanationInput as VarianceExplanationInput,
} from './variance-explanation.dto';

@Injectable()
export class ProgressReportVarianceExplanationRepository extends DtoRepository(
  VarianceExplanation,
) {
  async readMany(ids: readonly ID[]) {
    return await this.db
      .query()
      .matchNode('report', 'ProgressReport')
      .where({ 'report.id': inArray(ids) })
      .optionalMatch([
        node('report'),
        relation('out', '', 'varianceExplanation', ACTIVE),
        node('node', this.resource.dbLabel),
      ])
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected hydrate() {
    const defaults: UnsecuredDto<VarianceExplanation> & ExpressionInput = {
      report: { id: 'report.id' as ID },
      reasons: [],
      comments: null,
    };
    const ctx = ['report', 'node'];
    return (query: Query) =>
      query
        .subQuery((sub) =>
          sub
            .with(ctx)
            .apply(matchProps({ optional: true, excludeBaseProps: true }))
            .return<{ dto: UnsecuredDto<VarianceExplanation> }>(
              merge(defaults, 'props').as('dto'),
            ),
        )
        .return('dto');
  }

  async update(input: { id: ID } & Omit<VarianceExplanationInput, 'report'>) {
    const { id, ...changes } = input;
    await this.db
      .query()
      .matchNode('report', 'ProgressReport', { id })
      .merge([
        node('report'),
        relation('out', '', 'varianceExplanation', ACTIVE),
        node('node', this.resource.dbLabels),
      ])
      .with(['report', 'node'])
      .apply(
        updateProperties({
          resource: VarianceExplanation,
          changes,
        }),
      )
      .return('*')
      .run();

    return undefined as unknown;
  }
}
