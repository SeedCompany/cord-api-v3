import { Injectable } from '@nestjs/common';
import { node, relation, Node } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { Except } from 'type-fest';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  BaseNode,
  DbPropsOfDto,
  StandardReadResult,
} from '../../core/database/results';
import { Role } from '../authorization';
import {
  CreateProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  Product,
  ProductListInput,
  UpdateProduct,
} from './dto';

@Injectable()
export class ProductRepository {
  constructor(private readonly db: DatabaseService) {}

  query() {
    return this.db.query();
  }

  async findNode(type: 'engagement' | 'producible', id: ID) {
    if (type === 'engagement') {
      return await this.db
        .query()
        .match([node('engagement', 'Engagement', { id })])
        .return('engagement')
        .first();
    } else {
      return await this.db
        .query()
        .match([
          node('producible', 'Producible', {
            id,
          }),
        ])
        .return('producible')
        .first();
    }
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Product', { id })])
      .apply(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', 'product', { active: true }),
        node('', 'Product', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .apply(matchMemberRoles(session.userId))
      .return(['propList, node, memberRoles'])
      .asResult<
        StandardReadResult<
          DbPropsOfDto<
            DirectScriptureProduct &
              DerivativeScriptureProduct & {
                isOverriding: boolean;
              }
          >
        > & {
          memberRoles: Role[][];
        }
      >();
    return await query.first();
  }

  async connectedProducible(id: ID) {
    return await this.db
      .query()
      .match([
        node('product', 'Product', { id }),
        relation('out', 'produces', { active: true }),
        node('producible', 'Producible'),
      ])
      .return('producible')
      .asResult<{ producible: Node<BaseNode> }>()
      .first();
  }
  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }
  getActualDirectChanges(
    currentProduct: DirectScriptureProduct,
    input: Except<UpdateProduct, 'produces' | 'scriptureReferencesOverride'>
  ) {
    return this.db.getActualChanges(
      DirectScriptureProduct,
      currentProduct,
      input
    );
  }
  //fix type later
  async updateProperties(
    object: any,
    changes: DbChanges<DirectScriptureProduct>
  ) {
    return await this.db.updateProperties({
      type: DirectScriptureProduct,
      object,
      changes,
    });
  }

  getActualDerivativeChanges(
    currentProduct: DerivativeScriptureProduct,
    input: Except<UpdateProduct, 'scriptureReferences'>
  ) {
    return this.db.getActualChanges(
      DerivativeScriptureProduct,
      currentProduct,
      input
    );
  }

  async findProducible(produces: ID | undefined) {
    return await this.db
      .query()
      .match([
        node('producible', 'Producible', {
          id: produces,
        }),
      ])
      .return('producible')
      .first();
  }

  async updateProducible(
    input: Except<UpdateProduct, 'scriptureReferences'>,
    produces: ID
  ) {
    await this.db
      .query()
      .match([
        node('product', 'Product', { id: input.id }),
        relation('out', 'rel', 'produces', { active: true }),
        node('', 'Producible'),
      ])
      .setValues({
        'rel.active': false,
      })
      .return('rel')
      .first();

    await this.db
      .query()
      .match([node('product', 'Product', { id: input.id })])
      .match([
        node('producible', 'Producible', {
          id: produces,
        }),
      ])
      .create([
        node('product'),
        relation('out', 'rel', 'produces', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('producible'),
      ])
      .return('rel')
      .first();
  }
  //fix type later
  async updateDerivativeProperties(
    object: any,
    changes: DbChanges<DerivativeScriptureProduct>
  ) {
    return await this.db.updateProperties({
      type: DerivativeScriptureProduct,
      object,
      changes,
    });
  }
  //fix type later
  async deleteNode(node: any) {
    await this.db.deleteNode(node);
  }

  list({ filter, ...input }: ProductListInput, session: Session) {
    const label = 'Product';

    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.engagementId
          ? [
              relation('in', '', 'product', { active: true }),
              node('engagement', 'Engagement', {
                id: filter.engagementId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Product, input));
  }
}
