import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import {
  inArray,
  isNull,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { type Merge } from 'type-fest';
import {
  CreationFailed,
  EnhancedResource,
  type ID,
  NotFoundException,
  type Range,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { CommonRepository, type DbTypeOf, OnIndex } from '~/core/database';
import { getChanges } from '~/core/database/changes';
import {
  ACTIVE,
  collect,
  createNode,
  createRelationships,
  deactivateProperty,
  escapeLuceneSyntax,
  filter,
  FullTextIndex,
  matchProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import { ResourceResolver } from '../../core';
import { type BaseNode } from '../../core/database/results';
import {
  ScriptureReferenceRepository,
  ScriptureReferenceService,
} from '../scripture';
import {
  ScriptureRange as RawScriptureRange,
  type ScriptureRangeInput,
  type UnspecifiedScripturePortion,
  type UnspecifiedScripturePortionInput,
} from '../scripture/dto';
import {
  type AnyProduct,
  ApproachToMethodologies,
  type CreateDerivativeScriptureProduct,
  type CreateDirectScriptureProduct,
  type CreateOtherProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  type ProductMethodology as Methodology,
  OtherProduct,
  type Producible,
  type ProducibleType,
  Product,
  type ProductCompletionDescriptionSuggestionsInput,
  type ProductFilters,
  type ProductListInput,
  ProgressMeasurement,
  type UpdateDerivativeScriptureProduct,
  type UpdateDirectScriptureProduct,
  type UpdateOtherProduct,
} from './dto';

const ScriptureRange = EnhancedResource.of(RawScriptureRange);

export type HydratedProductRow = Merge<
  Omit<
    DbTypeOf<
      DirectScriptureProduct & DerivativeScriptureProduct & OtherProduct
    >,
    'scriptureReferencesOverride'
  >,
  {
    isOverriding: boolean;
    produces: Merge<DbTypeOf<Producible>, { __typename: string[] }> | null;
    unspecifiedScripture: UnspecifiedScripturePortion | null;
  }
>;

@Injectable()
export class ProductRepository extends CommonRepository {
  constructor(
    private readonly scriptureRefs: ScriptureReferenceRepository,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly resourceResolver: ResourceResolver,
  ) {
    super();
  }

  async readOne(id: ID) {
    const query = this.db
      .query()
      .matchNode('node', 'Product', { id })
      .apply(this.hydrate());
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find Product');
    }

    return result.dto;
  }

  async readOneUnsecured(id: ID) {
    const result = await this.readOne(id);
    return this.mapDbRowToDto(result);
  }

  async readMany(ids: readonly ID[]) {
    const query = this.db
      .query()
      .matchNode('node', 'Product')
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate())
      .map('dto');
    return await query.run();
  }

  async readManyUnsecured(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<UnsecuredDto<AnyProduct>>> {
    const rows = await this.readMany(ids);
    return rows.map((row) => this.mapDbRowToDto(row));
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
            node('scriptureRanges', ScriptureRange.dbLabel),
          ])
          .return(
            collect('scriptureRanges { .start, .end }').as('scriptureRanges'),
          ),
      )
      .return<{
        id: ID;
        pnpIndex?: number;
        scriptureRanges: ReadonlyArray<Range<number>>;
        unspecifiedScripture: UnspecifiedScripturePortion | null;
      }>([
        'node.id as id',
        'node.pnpIndex as pnpIndex',
        'scriptureRanges',
        'unspecifiedScripture { .book, .totalVerses } as unspecifiedScripture',
      ])
      .run();
  }

  async listIdsWithPnpIndexes(engagementId: ID, type?: string) {
    return await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'product', ACTIVE),
        node('node', ['Product', ...(type ? [type] : [])]),
      ])
      .where({ 'node.pnpIndex': not(isNull()) })
      .return<{ id: ID; pnpIndex: number }>([
        'node.id as id',
        'node.pnpIndex as pnpIndex',
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
    type?: ProducibleType,
  ) {
    const res = await this.db
      .query()
      .match([
        node('producible', ['Producible', ...(type ? [type] : [])]),
        relation('out', '', 'name', ACTIVE),
        node('prop', 'Property'),
      ])
      .where({ 'prop.value': inArray(names) })
      .return<{ id: ID; name: string }>([
        'producible.id as id',
        'prop.value as name',
      ])
      .run();
    return res;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('project', 'Project'),
          relation('out', '', 'engagement', ACTIVE),
          node('engagement', 'Engagement'),
          relation('out', '', 'product', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .optionalMatch([
          node('node'),
          relation('out', '', 'unspecifiedScripture', ACTIVE),
          node('unspecifiedScripture', 'UnspecifiedScripturePortion'),
        ])
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'produces', ACTIVE),
              node('produces', 'Producible'),
            ])
            .apply(matchProps({ nodeName: 'produces' }))
            .subQuery(
              'produces',
              this.scriptureRefs.list({
                nodeName: 'produces',
              }),
            )
            .with(
              merge('produces', 'props', {
                __typename: 'labels(produces)',
                scriptureReferences: 'scriptureReferences',
              }).as('produces'),
            )
            .return('collect(produces)[0] as produces'),
        )
        .subQuery(
          ['node', 'produces'],
          this.scriptureRefs.list({
            relationName: oneLine`
              CASE WHEN produces is null
                THEN "scriptureReferences"
                ELSE "scriptureReferencesOverride"
              END
            `,
          }),
        )
        .return<{ dto: HydratedProductRow }>(
          merge('props', {
            engagement: 'engagement { .id }',
            project: 'project { .id }',
            produces: 'produces',
            unspecifiedScripture:
              'unspecifiedScripture { .book, .totalVerses }',
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }

  getActualDirectChanges = getChanges(DirectScriptureProduct);

  async updateDirectProperties(changes: UpdateDirectScriptureProduct) {
    const { id, scriptureReferences, unspecifiedScripture, ...simpleChanges } =
      changes;

    await this.scriptureRefService.update(id, scriptureReferences);

    if (unspecifiedScripture !== undefined) {
      await this.updateUnspecifiedScripture(id, unspecifiedScripture);
    }

    await this.db.updateProperties({
      type: DirectScriptureProduct,
      object: { id },
      changes: simpleChanges,
    });

    return this.mapDbRowToDto(await this.readOne(id));
  }

  getActualDerivativeChanges = getChanges(DerivativeScriptureProduct);
  getActualOtherChanges = getChanges(OtherProduct);

  async findProducible(produces: ID | undefined) {
    const result = await this.db
      .query()
      .match([
        node('producible', 'Producible', {
          id: produces,
        }),
      ])
      .return<{ producible: BaseNode }>('producible')
      .first();

    if (!result) {
      throw new NotFoundException(
        'Could not find producible node',
        'product.produces',
      );
    }

    return result.producible;
  }

  async createDerivative(
    input: CreateDerivativeScriptureProduct & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ) {
    return (await this.create(
      input,
    )) as UnsecuredDto<DerivativeScriptureProduct>;
  }

  async createDirect(
    input: CreateDirectScriptureProduct & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ) {
    return (await this.create(input)) as UnsecuredDto<DirectScriptureProduct>;
  }

  private async create(
    input: (CreateDerivativeScriptureProduct | CreateDirectScriptureProduct) & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ) {
    const isDerivative = 'produces' in input;
    const Product = isDerivative
      ? DerivativeScriptureProduct
      : DirectScriptureProduct;
    const initialProps = {
      mediums: input.mediums ?? [],
      purposes: input.purposes ?? [],
      methodology: input.methodology,
      steps: input.steps ?? [],
      describeCompletion: input.describeCompletion,
      placeholderDescription: input.placeholderDescription,
      canDelete: true,
      progressTarget: input.progressTarget,
      progressStepMeasurement:
        input.progressStepMeasurement ?? ProgressMeasurement.Percent,
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
            pnpIndex: input.pnpIndex,
            createdAt: input.createdAt,
          },
        }),
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
        }),
      )
      // Connect scripture ranges
      .apply((q) => {
        const createdAt = DateTime.local();
        const connectScriptureRange =
          (label: string) => (range: ScriptureRangeInput) => [
            node('node'),
            relation('out', '', label, ACTIVE),
            node('', ScriptureRange.dbLabels, {
              ...ScriptureRange.type.fromReferences(range),
              createdAt,
            }),
          ];
        return q.create([
          ...(!isDerivative ? (input.scriptureReferences ?? []) : []).map(
            connectScriptureRange('scriptureReferences'),
          ),
          ...(isDerivative
            ? (input.scriptureReferencesOverride ?? [])
            : []
          ).map(connectScriptureRange('scriptureReferencesOverride')),
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
      throw new CreationFailed(Product);
    }

    return this.mapDbRowToDto(await this.readOne(result.id));
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
      progressStepMeasurement:
        input.progressStepMeasurement ?? ProgressMeasurement.Percent,
      placeholderDescription: input.placeholderDescription,
    };

    const query = this.db
      .query()
      .apply(
        await createNode(OtherProduct, {
          initialProps,
        }),
      )
      .apply(
        createRelationships(OtherProduct, 'in', {
          product: ['LanguageEngagement', input.engagementId],
        }),
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new CreationFailed(OtherProduct);
    }

    return this.mapDbRowToDto(
      await this.readOne(result.id),
    ) as UnsecuredDto<OtherProduct>;
  }

  async updateProducible(id: ID, produces: ID) {
    await this.db
      .query()
      .match([
        node('product', 'Product', { id }),
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
      .match([node('product', 'Product', { id })])
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
    input: UnspecifiedScripturePortionInput | null,
  ) {
    await this.db
      .query()
      .matchNode('node', 'Product', { id: productId })
      .apply(
        deactivateProperty({
          resource: DirectScriptureProduct,
          key: 'unspecifiedScripture',
        }),
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
          : q,
      )
      .return('numPropsDeactivated')
      .first();
  }

  async updateDerivativeProperties(changes: UpdateDerivativeScriptureProduct) {
    const { id, produces, scriptureReferencesOverride, ...simpleChanges } =
      changes;

    if (produces) {
      await this.findProducible(produces);
      await this.updateProducible(id, produces);
    }

    await this.scriptureRefService.update(id, scriptureReferencesOverride, {
      isOverriding: true,
    });

    await this.db.updateProperties({
      type: DerivativeScriptureProduct,
      object: { id },
      changes: simpleChanges,
    });

    return this.mapDbRowToDto(await this.readOne(id));
  }

  async updateOther(changes: UpdateOtherProduct) {
    const { id, ...simpleChanges } = changes;

    await this.db.updateProperties({
      type: OtherProduct,
      object: { id },
      changes: simpleChanges,
    });

    return this.mapDbRowToDto(await this.readOne(id));
  }

  async list(input: ProductListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'Product')
      .match([
        ...(input.filter?.engagementId
          ? [
              node('node'),
              relation('in', '', 'product', ACTIVE),
              node('engagement', 'Engagement', {
                id: input.filter.engagementId,
              }),
            ]
          : []),
      ])
      .apply((q) => {
        const { approach, methodology, ...rest } = input.filter ?? {};
        const merged = [
          ...(approach ? ApproachToMethodologies[approach] : []),
          ...(methodology ? [methodology] : []),
        ];
        productFilters({
          ...rest,
          ...(merged.length ? { methodology: merged } : {}),
        })(q);
      })
      .apply(sorting(Product, input))
      .apply(paginate(input, this.hydrate()))
      .first();

    return {
      // result from paginate() will always have 1 row
      ...result!,
      items: result!.items.map((row) => this.mapDbRowToDto(row)),
    };
  }

  async mergeCompletionDescription(
    description: string,
    methodology: Methodology,
  ) {
    await this.db
      .query()
      .merge(
        node('node', 'ProductCompletionDescription', {
          value: description,
          methodology,
        }),
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

  async delete(object: UnsecuredDto<AnyProduct>) {
    try {
      await this.deleteNode(object);
    } catch (exception) {
      throw new ServerException(
        `Failed to delete product ${object.id}`,
        exception,
      );
    }
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
          ? q.call(
              ProductCompletionDescriptionIndex.search(query).yield('node'),
            )
          : q.matchNode('node', 'ProductCompletionDescription'),
      )
      .apply((q) =>
        methodology ? q.with('node').where({ node: { methodology } }) : q,
      )
      .apply((q) =>
        query ? q : q.with('node').orderBy('node.lastUsedAt', 'DESC'),
      )
      .with('node.value as node')
      .apply(paginate(input, (q) => q.return<{ dto: string }>('node as dto')))
      .first();
    return result!;
  }

  private mapDbRowToDto(row: HydratedProductRow): UnsecuredDto<AnyProduct> {
    const {
      isOverriding,
      produces: rawProducible,
      title,
      description,
      ...rawProps
    } = row;
    const props = {
      ...rawProps,
      mediums: rawProps.mediums ?? [],
      purposes: rawProps.purposes ?? [],
      steps: rawProps.steps ?? [],
      scriptureReferences: this.scriptureRefService.parseList(
        rawProps.scriptureReferences,
      ),
    };

    if (title) {
      const dto: UnsecuredDto<OtherProduct> = {
        ...props,
        title,
        description,
        __typename: 'OtherProduct',
      };
      return dto;
    }

    if (!rawProducible) {
      const dto: UnsecuredDto<DirectScriptureProduct> = {
        ...props,
        totalVerses: props.totalVerses ?? 0,
        totalVerseEquivalents: props.totalVerseEquivalents ?? 0,
        __typename: 'DirectScriptureProduct',
      };
      return dto;
    }

    const producible = {
      ...rawProducible,
      scriptureReferences: this.scriptureRefService.parseList(
        rawProducible.scriptureReferences,
      ),
    };

    const producibleType = this.resourceResolver.resolveType(
      producible.__typename,
    ) as ProducibleType;

    const dto: UnsecuredDto<DerivativeScriptureProduct> = {
      ...props,
      produces: { ...producible, __typename: producibleType },
      scriptureReferences: !isOverriding
        ? producible.scriptureReferences
        : props.scriptureReferences,
      scriptureReferencesOverride: !isOverriding
        ? null
        : props.scriptureReferences,
      __typename: 'DerivativeScriptureProduct',
    };
    return dto;
  }

  @OnIndex('schema')
  private async createCompletionDescriptionIndex() {
    await this.db
      .query()
      .apply(ProductCompletionDescriptionIndex.create())
      .run();
  }

  @OnIndex()
  private createResourceIndexes() {
    return this.getConstraintsFor(Product);
  }
}

export const productFilters = filter.define<
  Omit<ProductFilters, 'approach' | 'methodology'> & {
    methodology?: Methodology[];
  }
>(() => undefined as any, {
  engagementId: filter.skip,
  placeholder: filter.isPropNotNull('placeholderDescription'),
  methodology: filter.stringListProp(),
});

const ProductCompletionDescriptionIndex = FullTextIndex({
  indexName: 'ProductCompletionDescription',
  labels: 'ProductCompletionDescription',
  properties: 'value',
  analyzer: 'standard-folding',
});
