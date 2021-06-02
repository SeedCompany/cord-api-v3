import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
import { DtoRepository, matchRequestingUser, property } from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { CreateProductStep, ProductStep, ProductStepListInput } from './dto';

@Injectable()
export class ProductStepRepository extends DtoRepository(ProductStep) {
  async create(input: CreateProductStep, createdAt: DateTime, id: ID) {
    const createProductStep = this.db
      .query()
      .create([
        [
          node('newProductStep', ['ProductStep', 'BaseNode', 'ProductStep'], {
            createdAt,
            id,
          }),
        ],
        ...property('name', input.name, 'newProductStep'),
        ...property('progress', input.progress, 'newProductStep'),
        ...property('description', input.description, 'newProductStep'),
      ])
      .return('newProductStep.id as id');
    return await createProductStep.first();
  }

  async createProperties(input: CreateProductStep, result: Dictionary<any>) {
    await this.db
      .query()
      .match(node('node', 'Product', { id: input.productId }))
      .match(node('productStep', 'ProductStep', { id: result.id }))
      .create([
        node('node'),
        relation('out', '', 'productStep', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('productStep'),
      ])
      .run();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'ProductStep', { id })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<ProductStep>>>();

    return await query.first();
  }

  list(productId: string, { filter, ...input }: ProductStepListInput) {
    return this.db
      .query()
      .match([
        node('product', 'Product', { id: productId }),
        relation('out', '', 'productStep', { active: true }),
        node('node', 'ProductStep'),
      ])
      .apply(calculateTotalAndPaginateList(ProductStep, input));
  }
}
