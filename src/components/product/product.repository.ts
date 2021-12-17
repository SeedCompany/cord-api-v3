import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Except, Merge } from 'type-fest';
import {
  getDbClassLabels,
  has,
  ID,
  NotFoundException,
  Range,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { CommonRepository, OnIndex } from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
import {
  ACTIVE,
  collect,
  createNode,
  createRelationships,
  deactivateProperty,
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
import {
  ScriptureRange,
  ScriptureRangeInput,
  UnspecifiedScripturePortion,
  UnspecifiedScripturePortionInput,
} from '../scripture';
import {
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  CreateOtherProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  ProductMethodology as Methodology,
  OtherProduct,
  ProducibleType,
  Product,
  ProductCompletionDescriptionSuggestionsInput,
  ProductListInput,
  UpdateProduct,
} from './dto';
import { productListFilter } from './query.helpers';

@Injectable()
export class ProductRepository extends CommonRepository {
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

  async listIdsAndScriptureRefs(engagementId: ID) {
    return await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'product', ACTIVE),
        node('node', 'DirectScriptureProduct'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'unspecifiedScripture', ACTIVE),
        node('unspecifiedScripture', 'UnspecifiedScripturePortion'),
      ])
      .subQuery('node', (sub) =>
        // Only concerned with Direct Scripture Products for this, so no need to worry about overrides
        sub
          .match([
            node('node'),
            relation('out', '', 'scriptureReferences', ACTIVE),
            node('scriptureRanges', 'ScriptureRange'),
          ])
          .return(
            collect('scriptureRanges { .start, .end }').as('scriptureRanges')
          )
      )
      .return<{
        id: ID;
        scriptureRanges: ReadonlyArray<Range<number>>;
        unspecifiedScripture: UnspecifiedScripturePortion | null;
      }>([
        'node.id as id',
        'scriptureRanges',
        'unspecifiedScripture { .book, .totalVerses } as unspecifiedScripture',
      ])
      .run();
  }

  async listIdsWithProducibleNames(engagementId: ID, type?: ProducibleType) {
    return await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'product', ACTIVE),
        node('node', 'DerivativeScriptureProduct'),
        relation('out', '', 'produces', ACTIVE),
        node('', ['Producible', ...(type ? [type] : [])]),
        relation('out', '', 'name', ACTIVE),
        node('name', 'Property'),
      ])
      .return<{ id: ID; name: string }>(['node.id as id', 'name.value as name'])
      .run();
  }

  async getProducibleIdsByNames(
    names: readonly string[],
    type?: ProducibleType
  ) {
    const res = await this.db
      .query()
      .match([
        node('producible', ['Producible', ...(type ? [type] : [])]),
        relation('out', '', 'name', ACTIVE),
        node('prop', 'Property'),
      ])
      .where({ 'prop.value': inArray([...names]) })
      .return<{ id: ID; name: string }>([
        'producible.id as id',
        'prop.value as name',
      ])
      .run();
    return res;
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
        .optionalMatch([
          node('node'),
          relation('out', '', 'unspecifiedScripture', ACTIVE),
          node('unspecifiedScripture', 'UnspecifiedScripturePortion'),
        ])
        .return<{
          dto: Merge<
            Omit<
              UnsecuredDto<
                DirectScriptureProduct &
                  DerivativeScriptureProduct &
                  OtherProduct
              >,
              'scriptureReferences' | 'scriptureReferencesOverride'
            >,
            {
              isOverriding: boolean;
              produces: BaseNode | null;
              unspecifiedScripture: UnspecifiedScripturePortion | null;
            }
          >;
        }>(
          merge('props', {
            engagement: 'engagement.id',
            produces: 'produces',
            unspecifiedScripture:
              'unspecifiedScripture { .book, .totalVerses }',
          }).as('dto')
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

  async create(
    input: (CreateDerivativeScriptureProduct | CreateDirectScriptureProduct) & {
      totalVerses: number;
      totalVerseEquivalents: number;
    }
  ) {
    const isDerivative = has('produces', input);
    const Product = isDerivative
      ? DerivativeScriptureProduct
      : DirectScriptureProduct;
    const initialProps = {
      mediums: input.mediums ?? [],
      purposes: input.purposes ?? [],
      methodology: input.methodology,
      steps: input.steps ?? [],
      describeCompletion: input.describeCompletion,
      canDelete: true,
      progressTarget: input.progressTarget,
      progressStepMeasurement: input.progressStepMeasurement,
      ...(isDerivative
        ? {
            isOverriding: !!input.scriptureReferencesOverride,
            composite: input.composite ?? false,
          }
        : {}),
      totalVerses: input.totalVerses,
      totalVerseEquivalents: input.totalVerseEquivalents,
    };

    const query = this.db
      .query()
      .apply(
        await createNode(Product, {
          initialProps,
          baseNodeProps: {
            createdAt: input.createdAt,
          },
        })
      )
      .apply(
        createRelationships(Product, {
          in: {
            product: ['LanguageEngagement', input.engagementId],
          },
          out: isDerivative
            ? {
                produces: ['Producible', input.produces],
              }
            : {},
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
          ...(!isDerivative ? input.scriptureReferences ?? [] : []).map(
            connectScriptureRange('scriptureReferences')
          ),
          ...(isDerivative ? input.scriptureReferencesOverride ?? [] : []).map(
            connectScriptureRange('scriptureReferencesOverride')
          ),
          !isDerivative && input.unspecifiedScripture
            ? [
                node('node'),
                relation('out', '', 'unspecifiedScripture', ACTIVE),
                node('', ['UnspecifiedScripturePortion', 'Property'], {
                  ...input.unspecifiedScripture,
                  createdAt,
                }),
              ]
            : [],
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
      mediums: input.mediums ?? [],
      purposes: input.purposes ?? [],
      methodology: input.methodology,
      steps: input.steps ?? [],
      describeCompletion: input.describeCompletion,
      title: input.title,
      description: input.description,
      canDelete: true,
      progressTarget: input.progressTarget,
      progressStepMeasurement: input.progressStepMeasurement,
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

  async updateUnspecifiedScripture(
    productId: ID,
    input: UnspecifiedScripturePortionInput | null
  ) {
    await this.db
      .query()
      .matchNode('node', 'Product', { id: productId })
      .apply(
        deactivateProperty({
          resource: DirectScriptureProduct,
          key: 'unspecifiedScripture',
        })
      )
      .apply((q) =>
        input
          ? q.create([
              node('node'),
              relation('out', 'rel', 'unspecifiedScripture', ACTIVE),
              node('', ['UnspecifiedScripturePortion', 'Property'], {
                ...input,
                createdAt: DateTime.local(),
              }),
            ])
          : q
      )
      .return('numPropsDeactivated')
      .first();
  }

  async updateDerivativeProperties(
    object: DerivativeScriptureProduct,
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
      .apply(productListFilter(filter))
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

  @OnIndex()
  private createResourceIndexes() {
    return this.getConstraintsFor(Product);
  }
}
