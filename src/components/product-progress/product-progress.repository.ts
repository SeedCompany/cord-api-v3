import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  getDbClassLabels,
  ID,
  NotFoundException,
} from '../../common';
import { DatabaseService } from '../../core';
import {
  collect,
  matchProps,
  merge,
  updateProperty,
  variable,
} from '../../core/database/query';
import { PeriodicReportService, ReportType } from '../periodic-report';
import {
  ProductProgress,
  ProductProgressInput,
  StepProgress,
  UnsecuredProductProgress,
} from './dto';

@Injectable()
export class ProductProgressRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly reports: PeriodicReportService
  ) {}

  async readOne(productId: ID, reportId: ID) {
    const result = await this.db
      .query()
      .match([
        [node('product', 'Product', { id: productId })],
        [node('report', 'PeriodicReport', { id: reportId })],
      ])
      .apply(this.hydrateAll())
      .first();
    if (!result) {
      throw new NotFoundException(
        'Could not find progress for product and report period'
      );
    }
    return result;
  }

  async readOneForCurrentReport(productId: ID) {
    const result = await this.db
      .query()
      .match(node('product', 'Product', { id: productId }))
      .subQuery('product', (sub) =>
        sub
          .match([
            node('product'),
            relation('in', '', 'product'),
            node('baseNode', 'Engagement'),
          ])
          .apply(
            this.reports.matchCurrentDue(
              variable('baseNode.id'),
              ReportType.Progress
            )
          )
          .return('node as report')
      )
      .apply(this.hydrateAll())
      .first();
    return result;
  }

  async readAllProgressReportsByProduct(productId: ID) {
    const result = await this.db
      .query()
      .match([
        [
          node('eng', 'Engagement'),
          relation('out', '', 'product', { active: true }),
          node('product', 'Product', { id: productId }),
        ],
        [
          node('eng'),
          relation('out', '', 'report', { active: true }),
          node('report', 'ProgressReport'),
        ],
      ])
      .apply(this.hydrateAll())
      .run();
    return result;
  }

  async readAllProgressReportsByReport(reportId: ID) {
    const result = await this.db
      .query()
      .match([
        [
          node('eng', 'Engagement'),
          relation('out', '', 'report', { active: true }),
          node('report', 'ProgressReport', { id: reportId }),
        ],
        [
          node('eng'),
          relation('out', '', 'product', { active: true }),
          node('product', 'Product'),
        ],
      ])
      .apply(this.hydrateAll())
      .run();
    return result;
  }

  private hydrateAll() {
    return <R>(query: Query<R>) =>
      query
        .comment('hydrateAll()')
        .optionalMatch([
          node('report'),
          relation('out', '', 'progress', { active: true }),
          node('progress', 'ProductProgress'),
          relation('in', '', 'progress', { active: true }),
          node('product'),
        ])
        .apply(this.hydrateOne())
        .return('dto')
        .map('dto');
  }

  private hydrateOne() {
    return <R>(query: Query<R>) =>
      query.comment`hydrateOne()`.subQuery(
        ['product', 'report', 'progress'],
        (sub1) =>
          sub1
            .subQuery(['product', 'report', 'progress'], (sub2) =>
              sub2
                .match([
                  node('progress'),
                  relation('out', '', 'step', { active: true }),
                  node('stepNode', 'StepProgress'),
                ])
                .apply(matchProps({ nodeName: 'stepNode', outputVar: 'step' }))
                .raw('WITH * WHERE step.percentDone IS NOT NULL')
                .return('step')
            )
            .return<{ dto: UnsecuredProductProgress }>(
              merge('progress', {
                productId: 'product.id',
                reportId: 'report.id',
                steps: collect('step'),
              }).as('dto')
            )
      );
  }

  async update(input: ProductProgressInput) {
    const createdAt = DateTime.local();
    // Create temp IDs in case the Progress/Step nodes need to be created.
    const tempProgressId = await generateId();
    const stepsInput = await Promise.all(
      input.steps.map(async (stepIn) => ({
        ...stepIn,
        tempId: await generateId(),
      }))
    );

    const query = this.db
      .query()
      .match([node('product', 'Product', { id: input.productId })])
      .match([node('report', 'PeriodicReport', { id: input.reportId })])

      .comment('Create ProductProgress if needed')
      .subQuery(['product', 'report'], (sub) =>
        sub
          .merge([
            node('product'),
            relation('out', 'productProgressRel', 'progress', { active: true }),
            node('progress', 'ProductProgress'),
            relation('in', 'reportProgressRel', 'progress', { active: true }),
            node('report'),
          ])
          .onCreate.set(
            {
              labels: {
                progress: getDbClassLabels(ProductProgress),
              },
              values: {
                progress: { id: tempProgressId, createdAt },
                productProgressRel: { createdAt },
                reportProgressRel: { createdAt },
              },
            },
            { merge: true }
          )
          .return('progress')
      )

      .comment('For each step input given')
      .subQuery('progress', (sub) =>
        sub
          .unwind(stepsInput, 'stepInput')

          .comment('Match or Create StepProgress')
          .subQuery(['progress', 'stepInput'], (sub2) =>
            sub2
              .merge([
                node('progress'),
                relation('out', 'progressStepRel', 'step', { active: true }),
                node('stepNode', 'StepProgress', {
                  step: variable('stepInput.step'),
                }),
              ])
              .onCreate.set(
                {
                  labels: {
                    stepNode: getDbClassLabels(StepProgress),
                  },
                  values: {
                    stepNode: { createdAt },
                    progressStepRel: { createdAt },
                  },
                },
                { merge: true }
              )
              .onCreate.setVariables({
                stepNode: { id: 'stepInput.tempId' },
              })
              .return('stepNode')
          ).raw`
            // Update percents that have changed
            WITH *
            WHERE NOT (stepNode)-[:percentDone { active: true }]->(:Property { value: stepInput.percentDone })
          `
          .apply(
            updateProperty({
              nodeName: 'stepNode',
              resource: StepProgress,
              key: 'percentDone',
              variable: 'stepInput.percentDone',
            })
          )
          .return([
            'sum(numPropsCreated) as numProgressPercentCreated',
            'sum(numPropsDeactivated) as numProgressPercentDeactivated',
          ])
      )

      .comment('Now read back progress node')
      .apply(this.hydrateOne())
      .return([
        'dto',
        'numProgressPercentCreated',
        'numProgressPercentDeactivated',
      ]);

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find product or report to add progress to'
      );
    }
    return result.dto;
  }
}
