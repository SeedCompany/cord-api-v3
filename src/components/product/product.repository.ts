import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Except, Merge } from 'type-fest';
import {
  getDbClassLabels,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { CommonRepository, OnIndex } from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  escapeLuceneSyntax,
  fullTextQuery,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { BaseNode } from '../../core/database/results';
import { ScriptureRange, ScriptureRangeInput } from '../scripture';
import {
  CreateOtherProduct,
  CreateProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  ProductMethodology as Methodology,
  OtherProduct,
  Product,
  ProductCompletionDescriptionSuggestionsInput,
  ProductListInput,
  UpdateProduct,
} from './dto';
import { ProgressMeasurement } from './dto/progress-measurement.enum';

@Injectable()
export class ProductRepository extends CommonRepository {
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
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement', 'Engagement'),
        relation('out', '', 'product', ACTIVE),
        node('node', 'Product', { id }),
      ])
      .apply(this.hydrate(session));
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find product');
    }
    return result.dto;
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .optionalMatch([
          node('node'),
          relation('out', '', 'produces', ACTIVE),
          node('produces', 'Producible'),
        ])
        .return<{
          dto: Merge<
            Omit<
              UnsecuredDto<DirectScriptureProduct & DerivativeScriptureProduct>,
              'scriptureReferences' | 'scriptureReferencesOverride'
            >,
            {
              isOverriding: boolean;
              produces: BaseNode | null;
            }
          >;
        }>(
          merge(
            {
              // BC with existing products
              progressStepMeasurement: `"${ProgressMeasurement.Percent}"`,
              progressTarget: 100,
            },
            'props',
            {
              engagement: 'engagement.id',
              scope: 'scopedRoles',
              produces: 'produces',
            }
          ).as('dto')
        );
  }

  getActualDirectChanges = getChanges(DirectScriptureProduct);

  async updateProperties(
    object: DirectScriptureProduct,
    changes: DbChanges<DirectScriptureProduct>
  ) {
    return await this.db.updateProperties({
      type: DirectScriptureProduct,
      object,
      changes,
    });
  }

  getActualDerivativeChanges = getChanges(DerivativeScriptureProduct);
  getActualOtherChanges = getChanges(OtherProduct);

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

  async create(input: CreateProduct) {
    const Product = input.produces
      ? DerivativeScriptureProduct
      : DirectScriptureProduct;
    const initialProps = {
      mediums: input.mediums,
      purposes: input.purposes,
      methodology: input.methodology,
      steps: input.steps,
      describeCompletion: input.describeCompletion,
      isOverriding: !!input.scriptureReferencesOverride,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(
        await createNode(Product, {
          initialProps,
        })
      )
      .apply(
        createRelationships(Product, {
          in: {
            product: ['LanguageEngagement', input.engagementId],
          },
          out: {
            produces: ['Producible', input.produces],
          },
        })
      )
      // Connect scripture ranges
      .apply((q) => {
        const createdAt = DateTime.local();
        const connectScriptureRange =
          (label: string) => (range: ScriptureRangeInput) =>
            [
              node('node'),
              relation('out', '', label, ACTIVE),
              node('', getDbClassLabels(ScriptureRange), {
                ...ScriptureRange.fromReferences(range),
                createdAt,
              }),
            ];
        return q.create([
          ...(!input.produces ? input.scriptureReferences ?? [] : []).map(
            connectScriptureRange('scriptureReferences')
          ),
          ...(input.produces
            ? input.scriptureReferencesOverride ?? []
            : []
          ).map(connectScriptureRange('scriptureReferencesOverride')),
        ]);
      })
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create product');
    }
    return result.id;
  }

  async createOther(input: CreateOtherProduct) {
    const initialProps = {
      mediums: input.mediums,
      purposes: input.purposes,
      methodology: input.methodology,
      steps: input.steps,
      describeCompletion: input.describeCompletion,
      title: input.title,
      description: input.description,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(
        await createNode(OtherProduct, {
          initialProps,
        })
      )
      .apply(
        createRelationships(OtherProduct, 'in', {
          product: ['LanguageEngagement', input.engagementId],
        })
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create product');
    }
    return result.id;
  }

  async updateProducible(
    input: Except<UpdateProduct, 'scriptureReferences'>,
    produces: ID
  ) {
    await this.db
      .query()
      .match([
        node('product', 'Product', { id: input.id }),
        relation('out', 'rel', 'produces', ACTIVE),
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

  async updateDerivativeProperties(
    object: Except<
      DerivativeScriptureProduct,
      'produces' | 'scriptureReferencesOverride'
    >,
    changes: DbChanges<DerivativeScriptureProduct>
  ) {
    return await this.db.updateProperties({
      type: DerivativeScriptureProduct,
      object,
      changes,
    });
  }

  async updateOther(object: OtherProduct, changes: DbChanges<OtherProduct>) {
    return await this.db.updateProperties({
      type: OtherProduct,
      object,
      changes,
    });
  }

  async list({ filter, ...input }: ProductListInput, session: Session) {
    const label = 'Product';
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.engagementId
          ? [
              relation('in', '', 'product', ACTIVE),
              node('engagement', 'Engagement', {
                id: filter.engagementId,
              }),
            ]
          : []),
      ])
      .apply(sorting(Product, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async mergeCompletionDescription(
    description: string,
    methodology: Methodology
  ) {
    await this.db
      .query()
      .merge(
        node('node', 'ProductCompletionDescription', {
          value: description,
          methodology,
        })
      )
      .onCreate.setVariables({
        'node.lastUsedAt': 'datetime()',
        'node.createdAt': 'datetime()',
      })
      .onMatch.setVariables({
        'node.lastUsedAt': 'datetime()',
      })
      .run();
  }

  async suggestCompletionDescriptions({
    query: queryInput,
    methodology,
    ...input
  }: ProductCompletionDescriptionSuggestionsInput) {
    const query = queryInput ? escapeLuceneSyntax(queryInput) : undefined;
    const result = await this.db
      .query()
      .apply((q) =>
        query
          ? q.apply(fullTextQuery('ProductCompletionDescription', query))
          : q.matchNode('node', 'ProductCompletionDescription')
      )
      .apply((q) =>
        methodology ? q.with('node').where({ node: { methodology } }) : q
      )
      .apply((q) =>
        query ? q : q.with('node').orderBy('node.lastUsedAt', 'DESC')
      )
      .with('node.value as node')
      .apply(paginate(input, (q) => q.return<{ dto: string }>('node as dto')))
      .first();
    return result!;
  }

  @OnIndex('schema')
  private async createCompletionDescriptionIndex() {
    await this.db.createFullTextIndex(
      'ProductCompletionDescription',
      ['ProductCompletionDescription'],
      ['value'],
      {
        analyzer: 'standard-folding',
      }
    );
  }
}
