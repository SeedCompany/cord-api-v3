import { Injectable } from '@nestjs/common';
import {
  inArray,
  isNull,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core';
import { DbChanges } from '~/core/database/changes';
import {
  ACTIVE,
  exp,
  ExpressionInput,
  matchProps,
  merge,
  updateProperties,
} from '~/core/database/query';
import { ProgressReport } from '../dto';
import {
  ProgressReportVarianceExplanation as VarianceExplanation,
  ProgressReportVarianceExplanationInput as VarianceExplanationInput,
} from './variance-explanation.dto';

@Injectable()
export class ProgressReportVarianceExplanationRepository extends DtoRepository(
  VarianceExplanation
) {
  // @ts-expect-error It doesn't have match base signature
  async readMany(reports: readonly ProgressReport[]) {
    return await this.db
      .query()
      .matchNode('report', 'ProgressReport')
      .where({ 'report.id': inArray(reports.map((r) => r.id)) })
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
    const placeholder: UnsecuredDto<VarianceExplanation> & ExpressionInput = {
      report: 'report.id' as ID,
      reasons: [],
      comments: null,
    };
    const ctx = ['report', 'node'];
    return (query: Query) =>
      query
        .subQuery((sub) =>
          sub
            .with(ctx)
            .with(ctx)
            .where({ node: not(isNull()) })
            .apply(matchProps())
            .return<{ dto: UnsecuredDto<VarianceExplanation> }>(
              merge('props', {
                report: 'report.id',
              }).as('dto')
            )
            .union()
            .with(ctx)
            .with(ctx)
            .where({ node: isNull() })
            .return(exp(placeholder).as('dto'))
        )
        .return('dto');
  }

  async update(
    reportId: ID,
    changes: DbChanges<VarianceExplanationInput>,
    _session: Session
  ) {
    await this.db
      .query()
      .matchNode('report', 'ProgressReport', { id: reportId })
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
        })
      )
      .return('*')
      .run();
  }
}
