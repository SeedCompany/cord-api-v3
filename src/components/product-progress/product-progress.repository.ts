import { Injectable } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  getDbClassLabels,
  ID,
  NotFoundException,
  Session,
} from '../../common';
import { DatabaseService } from '../../core';
import {
  ACTIVE,
  collect,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  updateProperty,
  variable,
} from '../../core/database/query';
import { PeriodicReportService, ReportType } from '../periodic-report';
import { ProductStep } from '../product';
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

  async readAllProgressReportsForManyProducts(productIds: ID[]) {
    const result = await this.db
      .query()
      .match([
        node('eng'),
        relation('out', '', 'product', ACTIVE),
        node('product', 'Product'),
      ])
      .where({ 'product.id': inArray(productIds) })
      .subQuery(['eng', 'product'], (sub) =>
        sub
          .match([
            node('eng', 'Engagement'),
            relation('out', '', 'report', ACTIVE),
            node('report', 'ProgressReport'),
          ])
          .subQuery(['report', 'product'], this.hydrateAll())
          .return(collect('dto').as('progressList'))
      )
      .return<{ productId: ID; progressList: UnsecuredProductProgress[] }>([
        'product.id as productId',
        'progressList',
      ])
      .run();
    return result;
  }

  async readAllProgressReportsForManyReports(reportIds: ID[]) {
    const result = await this.db
      .query()
      .match([
        node('eng', 'Engagement'),
        relation('out', '', 'report', ACTIVE),
        node('report', 'ProgressReport'),
      ])
      .where({ 'report.id': inArray(reportIds) })
      .subQuery(['eng', 'report'], (sub) =>
        sub
          .match([
            node('eng'),
            relation('out', '', 'product', ACTIVE),
            node('product', 'Product'),
          ])
          .subQuery(['report', 'product'], this.hydrateAll())
          .return(collect('dto').as('progressList'))
      )
      .return<{ reportId: ID; progressList: UnsecuredProductProgress[] }>([
        'report.id as reportId',
        'progressList',
      ])
      .run();
    return result;
  }

  private hydrateAll() {
    return <R>(query: Query<R>) =>
      query
        .comment('hydrateAll()')
        .optionalMatch([
          node('report'),
          relation('out', '', 'progress', ACTIVE),
          node('progress', 'ProductProgress'),
          relation('in', '', 'progress', ACTIVE),
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
                  relation('out', '', 'step', ACTIVE),
                  node('stepNode', 'StepProgress'),
                ])
                .apply(matchProps({ nodeName: 'stepNode', outputVar: 'step' }))
                .return(collect('step').as('steps'))
            )
            .match([
              node('product'),
              relation('out', '', 'steps', ACTIVE),
              node('declaredSteps', 'Property'),
            ])
            .with([
              '*',
              // Convert StepProgress list to a map keyed by step
              'apoc.map.fromPairs([sp in steps | [sp.step, sp]]) as progressStepMap',
            ])
            .return<{ dto: UnsecuredProductProgress }>(
              // FYI `progress` is nullable, so this could include its props or not.
              merge('progress', {
                productId: 'product.id',
                reportId: 'report.id',
                // Convert the products step strings into actual StepProgress
                // or fallback to a placeholder. This ensures that the list is
                // in the correct order and indicates which steps still need
                // progress reported.
                steps: stripIndent`
                  [step in declaredSteps.value |
                    apoc.map.get(progressStepMap, step, { step: step, completed: null })
                  ]
                `,
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
            relation('out', 'productProgressRel', 'progress', ACTIVE),
            node('progress', 'ProductProgress'),
            relation('in', 'reportProgressRel', 'progress', ACTIVE),
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
                relation('out', 'progressStepRel', 'step', ACTIVE),
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
            // Update current completed values that have changed
            WITH *
            WHERE NOT (stepNode)-[:completed { active: true }]->(:Property { value: stepInput.completed })
          `
          .apply(
            updateProperty({
              nodeName: 'stepNode',
              resource: StepProgress,
              key: 'completed',
              variable: 'stepInput.completed',
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

  async getScope(productId: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('product', 'Product', { id: productId }),
        relation('in', '', 'product'),
        node('engagement', 'Engagement'),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .apply(matchProjectScopedRoles({ session, outputVar: 'scope' }))
      .apply(matchProjectSens())
      .subQuery('product', (sub) =>
        sub
          .match([
            node('steps', 'Property'),
            relation('in', '', 'steps', ACTIVE),
            node('product'),
            relation('out', '', 'progressTarget', ACTIVE),
            node('progressTarget', 'Property'),
          ])
          .return<{ progressTarget: number; steps: ProductStep[] }>(
            'progressTarget.value as progressTarget, steps.value as steps'
          )
      )
      .return(['sensitivity', 'scope', 'progressTarget', 'steps']);
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find product');
    }
    return result;
  }
}
