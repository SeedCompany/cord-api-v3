import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, NotFoundException, UnsecuredDto } from '../../common';
import { DatabaseService, property } from '../../core';
import { matchProps } from '../../core/database/query';
import { ProductProgressInput, StepProgress } from './dto';

@Injectable()
export class ProductProgressRepository {
  constructor(private readonly db: DatabaseService) {}

  async removeOldProgress(productId: ID, reportId: ID) {
    await this.db
      .query()
      .match([
        node('product', 'Product', { id: productId }),
        relation('out', 'productProgressRel', 'productProgress', {
          active: true,
        }),
        node('node', 'ProductProgress'),
        relation('in', 'reportProgressRel', 'reportProgress', { active: true }),
        node('report', 'PeriodicReport', { id: reportId }),
      ])
      .setValues({
        'productProgressRel.active': false,
        'reportProgressRel.active': false,
      })
      .return('node.id as id')
      .asResult<{ id: ID }>()
      .run();
  }

  async create(input: ProductProgressInput) {
    const id = await generateId();
    const createdAt = DateTime.local();
    const query = this.db
      .query()
      .match([node('product', 'Product', { id: input.productId })])
      .match([node('report', 'PeriodicReport', { id: input.reportId })])
      .create([
        [
          node('node', ['ProductProgress', 'BaseNode'], {
            id,
            createdAt,
          }),
        ],
      ])
      .create([
        node('product'),
        relation('out', '', 'productProgress', { active: true, createdAt }),
        node('node'),
        relation('in', '', 'reportProgress', { active: true, createdAt }),
        node('report'),
      ])
      .return('node.id as id')
      .asResult<{ id: ID }>();
    const result = await query.first();

    if (!result?.id) {
      return;
    }
    await Promise.all(
      input.steps.map(async (step) => {
        const id = await generateId();
        const createdAt = DateTime.local();
        const query = this.db
          .query()
          .match([
            node('productProgress', 'ProductProgress', { id: result.id }),
          ])
          .create([
            [
              node('node', ['StepProgress', 'BaseNode'], {
                id,
                createdAt,
              }),
            ],
            ...property('step', step.step, 'node'),
            ...property('percentDone', step.percentDone, 'node'),
            ...property('description', step.description, 'node'),
          ])
          .create([
            node('productProgress'),
            relation('out', '', 'step', { active: true, createdAt }),
            node('node'),
          ])
          .return('node.id as id')
          .asResult<{ id: ID }>();

        await query.first();
      })
    );
  }

  async readSteps(productId: ID, reportId: ID) {
    const result = await this.db
      .query()
      .match([
        node('product', 'Product', { id: productId }),
        relation('out', '', 'productProgress', { active: true }),
        node('node', 'ProductProgress'),
        relation('in', '', 'reportProgress', { active: true }),
        node('report', 'PeriodicReport', { id: reportId }),
      ])
      .match([
        node('node'),
        relation('out', '', 'step', { active: true }),
        node('stepProgress', 'StepProgress'),
      ])
      .with('collect(stepProgress.id) as ids')
      .return('ids')
      .asResult<{ ids: [ID] }>()
      .first();

    if (!result?.ids) {
      return [];
    }

    const steps = await Promise.all(
      result?.ids.map(async (id) => await this.readOneStepProgress(id))
    );
    return steps;
  }

  async readAllProgressReportsByProduct(productId: ID) {
    const result = await this.db
      .query()
      .match([
        node('product', 'Product', { id: productId }),
        relation('out', '', 'productProgress', { active: true }),
        node('node', 'ProductProgress'),
        relation('in', '', 'reportProgress', { active: true }),
        node('report', 'PeriodicReport'),
      ])
      .with('collect(report.id) as reportIds')
      .return('reportIds')
      .asResult<{ reportIds: ID[] }>()
      .first();

    if (!result?.reportIds) {
      return [];
    }
    return result.reportIds;
  }

  async readAllProgressReportsByReport(reportId: ID) {
    const result = await this.db
      .query()
      .match([
        node('product', 'Product'),
        relation('out', '', 'productProgress', { active: true }),
        node('node', 'ProductProgress'),
        relation('in', '', 'reportProgress', { active: true }),
        node('report', 'PeriodicReport', { id: reportId }),
      ])
      .with('collect(product.id) as productIds')
      .return('productIds')
      .asResult<{ productIds: ID[] }>()
      .first();

    if (!result?.productIds) {
      return [];
    }
    return result.productIds;
  }

  async readOneStepProgress(id: ID) {
    const result = await this.db
      .query()
      .match([node('node', 'StepProgress', { id })])
      .apply(this.hydrate())
      .return('dto')
      .asResult<{ dto: UnsecuredDto<StepProgress> }>()
      .first();

    if (!result?.dto) {
      throw new NotFoundException();
    }
    return result.dto;
  }

  private hydrate() {
    return (query: Query) =>
      query.subQuery((sub) =>
        sub.with('node').apply(matchProps()).return('props as dto')
      );
  }
}
