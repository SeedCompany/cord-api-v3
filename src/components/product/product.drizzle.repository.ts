import { Injectable } from '@nestjs/common';
import { sortBy } from '@seedcompany/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  generateId,
  type ID,
  isSecured,
  type Range,
  ServerException,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type DbChanges, getChanges } from '~/core/database/changes';
import {
  DrizzleService,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import {
  engagements,
  producibles,
  productCompletionDescriptions,
  products,
} from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  ScriptureRange,
  type UnspecifiedScripturePortionInput,
} from '../scripture/dto';
import {
  ApproachToMethodologies,
  type CreateDerivativeScriptureProduct,
  type CreateDirectScriptureProduct,
  type CreateOtherProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  type ProductMethodology as Methodology,
  OtherProduct,
  type ProducibleType,
  type Product,
  type ProductCompletionDescriptionSuggestionsInput,
  type ProductListInput,
} from './dto';
import { type HydratedProductRow } from './product.repository';

type ProductRow = typeof products.$inferSelect & {
  engagement?: {
    id: ID<'Engagement'>;
    project?: { id: ID<'Project'>; sensitivity: string } | null;
  } | null;
  produces?: typeof producibles.$inferSelect | null;
};

const RELATIONS = {
  engagement: {
    columns: { id: true },
    with: { project: { columns: { id: true, sensitivity: true } } },
  },
  produces: true,
} as const;

/** The Neo4j label each concrete product type carries ⟷ the discriminator. */
const PRODUCT_TYPE_BY_LABEL: Record<
  string,
  (typeof products.type.enumValues)[number]
> = {
  DirectScriptureProduct: 'DirectScripture',
  DerivativeScriptureProduct: 'Derivative',
  OtherProduct: 'Other',
};

const PRODUCIBLE_TYPES = producibles.type.enumValues;

const parseRefs = (refs: ReadonlyArray<Range<number>>) =>
  sortBy(refs, [(r) => r.start, (r) => r.end]).map(ScriptureRange.fromIds);

/**
 * Columns the generic `update*Properties()` calls may touch — everything else
 * (scripture refs, produces, unspecified portion) flows through its own
 * dedicated method, mirroring the Neo4j repo's split.
 */
const SIMPLE_CHANGE_COLUMNS = [
  'mediums',
  'purposes',
  'methodology',
  'steps',
  'describeCompletion',
  'placeholderDescription',
  'progressStepMeasurement',
  'progressTarget',
  'totalVerses',
  'totalVerseEquivalents',
  'composite',
  'title',
  'description',
] as const;

@Injectable()
export class ProductDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  // Transaction-aware client — see DrizzleDtoRepository.db for why a getter.
  protected get db() {
    return this.drizzle.client;
  }

  getActualDirectChanges = getChanges(DirectScriptureProduct);
  getActualDerivativeChanges = getChanges(DerivativeScriptureProduct);
  getActualOtherChanges = getChanges(OtherProduct);

  async readMany(ids: readonly ID[]): Promise<HydratedProductRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.products.findMany({
      where: (p) => and(inArray(p.id, [...ids]), isNull(p.deletedAt)),
      with: RELATIONS,
    });
    return await this.hydrate(rows as ProductRow[]);
  }

  private async hydrate(rows: ProductRow[]): Promise<HydratedProductRow[]> {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => r.engagement?.project?.id ?? []),
    );
    return rows.map((row) =>
      this.mapRow(
        row,
        row.engagement?.project
          ? (scopeByProject.get(row.engagement.project.id) ?? [])
          : [],
      ),
    );
  }

  private mapRow(row: ProductRow, scope: ScopedRole[]): HydratedProductRow {
    if (!row.engagement?.project) {
      throw new ServerException(
        `Product ${row.id} has no parent engagement/project row — FK invariant violated`,
      );
    }
    const isDerivative = row.type === 'Derivative';
    const isOther = row.type === 'Other';
    const produces =
      isDerivative && row.produces
        ? {
            id: row.produces.id,
            // Shaped like Neo4j's labels(produces) for
            // ResourceResolver.resolveType().
            __typename: [row.produces.type, 'Producible'],
            createdAt: DateTime.fromJSDate(row.produces.createdAt),
            name: row.produces.name,
            scriptureReferences: parseRefs(row.produces.scriptureReferences),
            canDelete: true,
          }
        : null;
    const ownRefs = isDerivative
      ? (row.scriptureReferencesOverride ?? [])
      : row.scriptureReferences;
    const dto: unknown = {
      id: row.id,
      createdAt: DateTime.fromJSDate(row.createdAt),
      engagement: row.engagementId,
      project: row.engagement.project.id,
      sensitivity: row.engagement.project.sensitivity,
      scope,
      canDelete: true,
      mediums: row.mediums,
      purposes: row.purposes,
      methodology: row.methodology,
      steps: row.steps,
      describeCompletion: row.describeCompletion,
      placeholderDescription: row.placeholderDescription,
      progressStepMeasurement: row.progressStepMeasurement,
      progressTarget: row.progressTarget,
      totalVerses: row.totalVerses,
      totalVerseEquivalents: row.totalVerseEquivalents,
      pnpIndex: row.pnpIndex ?? undefined,
      scriptureReferences: parseRefs(ownRefs),
      isOverriding: isDerivative && row.scriptureReferencesOverride !== null,
      produces,
      unspecifiedScripture:
        row.unspecifiedScriptureBook != null &&
        row.unspecifiedScriptureTotalVerses != null
          ? {
              book: row.unspecifiedScriptureBook,
              totalVerses: row.unspecifiedScriptureTotalVerses,
            }
          : null,
      ...(isDerivative && { composite: row.composite ?? false }),
      title: isOther ? row.title : null,
      description: isOther ? row.description : null,
    };
    return dto as HydratedProductRow;
  }

  /**
   * Lookup shim for the service's pre-flight existence checks. Returns a
   * Neo4j-shaped BaseNode so `ResourceResolver.resolveTypeByBaseNode()` keeps
   * working — only `labels` and `properties.{id,createdAt}` are consumed.
   */
  async getBaseNode(id: ID, label?: unknown): Promise<BaseNode | undefined> {
    const asBaseNode = (labels: string[], createdAt: Date): BaseNode => ({
      identity: id,
      labels: [...labels, 'BaseNode'],
      properties: { id, createdAt: DateTime.fromJSDate(createdAt) },
    });
    if (label === 'Engagement') {
      const [row] = await this.db
        .select({ type: engagements.type, createdAt: engagements.createdAt })
        .from(engagements)
        .where(and(eq(engagements.id, id), isNull(engagements.deletedAt)));
      return row
        ? asBaseNode([`${row.type}Engagement`, 'Engagement'], row.createdAt)
        : undefined;
    }
    if (label === 'Producible') {
      const [row] = await this.db
        .select({ type: producibles.type, createdAt: producibles.createdAt })
        .from(producibles)
        .where(and(eq(producibles.id, id), isNull(producibles.deletedAt)));
      return row
        ? asBaseNode([row.type, 'Producible'], row.createdAt)
        : undefined;
    }
    throw new ServerException(
      `ProductDrizzleRepository.getBaseNode: label ${String(
        label,
      )} not supported`,
    );
  }

  async findProducible(produces: ID | undefined) {
    if (!produces) return undefined;
    const [row] = await this.db
      .select({ id: producibles.id })
      .from(producibles)
      .where(and(eq(producibles.id, produces), isNull(producibles.deletedAt)));
    return row;
  }

  async create(
    input: (CreateDerivativeScriptureProduct | CreateDirectScriptureProduct) & {
      totalVerses: number;
      totalVerseEquivalents: number;
    },
  ): Promise<ID> {
    const isDerivative = 'produces' in input && !!input.produces;
    const Product = isDerivative
      ? DerivativeScriptureProduct
      : DirectScriptureProduct;
    await this.verifyLanguageEngagement(input.engagement, Product);
    const id = await generateId<ID<'Product'>>();
    const derivative = isDerivative
      ? (input as CreateDerivativeScriptureProduct)
      : undefined;
    const direct = !isDerivative
      ? (input as CreateDirectScriptureProduct)
      : undefined;
    await this.db.insert(products).values({
      id,
      engagementId: input.engagement,
      type: isDerivative ? 'Derivative' : 'DirectScripture',
      mediums: input.mediums ?? [],
      purposes: input.purposes ?? [],
      methodology: input.methodology,
      steps: input.steps ?? [],
      describeCompletion: input.describeCompletion,
      placeholderDescription: input.placeholderDescription,
      progressTarget: input.progressTarget,
      progressStepMeasurement: input.progressStepMeasurement ?? 'Percent',
      totalVerses: input.totalVerses,
      totalVerseEquivalents: input.totalVerseEquivalents,
      pnpIndex: input.pnpIndex,
      createdAt: input.createdAt?.toJSDate(),
      ...(derivative && {
        producesId: derivative.produces,
        composite: derivative.composite ?? false,
        scriptureReferencesOverride: derivative.scriptureReferencesOverride
          ? derivative.scriptureReferencesOverride.map(
              ScriptureRange.fromReferences,
            )
          : null,
      }),
      ...(direct && {
        scriptureReferences: (direct.scriptureReferences ?? []).map(
          ScriptureRange.fromReferences,
        ),
        ...(direct.unspecifiedScripture && {
          unspecifiedScriptureBook: direct.unspecifiedScripture.book,
          unspecifiedScriptureTotalVerses:
            direct.unspecifiedScripture.totalVerses,
        }),
      }),
    });
    return id;
  }

  async createOther(input: CreateOtherProduct): Promise<ID> {
    await this.verifyLanguageEngagement(input.engagement, OtherProduct);
    const id = await generateId<ID<'Product'>>();
    await this.db.insert(products).values({
      id,
      engagementId: input.engagement,
      type: 'Other',
      title: input.title,
      description: input.description,
      mediums: input.mediums ?? [],
      purposes: input.purposes ?? [],
      methodology: input.methodology,
      steps: input.steps ?? [],
      describeCompletion: input.describeCompletion,
      placeholderDescription: input.placeholderDescription,
      progressTarget: input.progressTarget,
      progressStepMeasurement: input.progressStepMeasurement ?? 'Percent',
    });
    return id;
  }

  /**
   * Products hang off LanguageEngagements only — the Neo4j repo enforces this
   * via the typed relationship target; here it's a pre-flight check.
   */
  private async verifyLanguageEngagement(
    engagementId: ID,
    resource: ConstructorParameters<typeof CreationFailed>[0],
  ) {
    const [eng] = await this.db
      .select({ type: engagements.type })
      .from(engagements)
      .where(
        and(eq(engagements.id, engagementId), isNull(engagements.deletedAt)),
      );
    if (!eng || eng.type !== 'Language') {
      throw new CreationFailed(resource);
    }
  }

  async updateProperties(
    object: DirectScriptureProduct,
    changes: DbChanges<DirectScriptureProduct>,
  ) {
    return await this.applyChanges(object, changes);
  }

  async updateDerivativeProperties(
    object: DerivativeScriptureProduct,
    changes: DbChanges<DerivativeScriptureProduct>,
  ) {
    return await this.applyChanges(object, changes);
  }

  async updateOther(object: OtherProduct, changes: DbChanges<OtherProduct>) {
    return await this.applyChanges(object, changes);
  }

  /**
   * Write the simple-column subset of `changes`, then return `object` with
   * the changes merged in (secured-aware), matching the Neo4j
   * `db.updateProperties()` contract the service relies on.
   */
  private async applyChanges<T extends { id: ID }>(
    object: T,
    changes: Record<string, unknown>,
  ): Promise<T> {
    const cols: Record<string, unknown> = {};
    for (const key of SIMPLE_CHANGE_COLUMNS) {
      const value = changes[key];
      if (value !== undefined) {
        cols[key] = value;
      }
    }
    if (Object.keys(cols).length > 0) {
      cols.updatedAt = new Date();
      await this.db
        .update(products)
        .set(cols)
        .where(eq(products.id, object.id));
    }
    const updated: Record<string, unknown> = { ...object };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      const prev = updated[key];
      updated[key] = isSecured(prev) ? { ...prev, value } : value;
    }
    return updated as T;
  }

  async updateProducible(input: { id: ID }, produces: ID) {
    await this.db
      .update(products)
      .set({ producesId: produces, updatedAt: new Date() })
      .where(eq(products.id, input.id));
  }

  async updateUnspecifiedScripture(
    productId: ID,
    input: UnspecifiedScripturePortionInput | null,
  ) {
    await this.db
      .update(products)
      .set({
        unspecifiedScriptureBook: input?.book ?? null,
        unspecifiedScriptureTotalVerses: input?.totalVerses ?? null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  }

  async delete(id: ID, _resource?: unknown) {
    await this.db
      .update(products)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(products.id, id));
  }

  async list(input: ProductListInput) {
    const { approach, methodology, placeholder, engagementId } =
      input.filter ?? {};
    const methodologies = [
      ...(approach ? ApproachToMethodologies[approach] : []),
      ...(methodology ? [methodology] : []),
    ];
    const conditions: SQL[] = [isNull(products.deletedAt)];
    if (engagementId) {
      conditions.push(eq(products.engagementId, engagementId));
    }
    if (methodologies.length > 0) {
      conditions.push(inArray(products.methodology, methodologies));
    }
    if (placeholder !== undefined) {
      conditions.push(
        placeholder
          ? isNotNull(products.placeholderDescription)
          : isNull(products.placeholderDescription),
      );
    }
    const predicate = and(...conditions);
    const offset = (input.page - 1) * input.count;
    const [countResult, idRows] = await Promise.all([
      this.db.select({ total: count() }).from(products).where(predicate),
      this.db
        .select({ id: products.id })
        .from(products)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(
            input,
            // migration-todo: array/jsonb keys (mediums, purposes, steps,
            // scriptureReferences) and relation-derived keys deliberately
            // fall back to createdAt — the Neo4j `sorting(Product, input)`
            // sorts any prop lexically, but no client sorts products by
            // those; revisit at cutover if one appears.
            {
              createdAt: products.createdAt,
              methodology: products.methodology,
              describeCompletion: products.describeCompletion,
              placeholderDescription: products.placeholderDescription,
              progressStepMeasurement: products.progressStepMeasurement,
              progressTarget: products.progressTarget,
            } satisfies SortMap<keyof Product>,
            products.createdAt,
          ),
          asc(products.id),
        )
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countResult[0]?.total ?? 0;
    const items = await this.readMany(idRows.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      hasMore: offset + idRows.length < total,
      items: idRows.map((r) => byId.get(r.id)!).filter(Boolean),
    };
  }

  async mergeCompletionDescription(
    description: string,
    methodology: Methodology,
  ) {
    await this.db
      .insert(productCompletionDescriptions)
      .values({ value: description, methodology })
      .onConflictDoUpdate({
        target: [
          productCompletionDescriptions.value,
          productCompletionDescriptions.methodology,
        ],
        set: { lastUsedAt: new Date() },
      });
  }

  async suggestCompletionDescriptions({
    query: queryInput,
    methodology,
    ...input
  }: ProductCompletionDescriptionSuggestionsInput) {
    const conditions: SQL[] = [];
    if (methodology) {
      conditions.push(
        eq(productCompletionDescriptions.methodology, methodology),
      );
    }
    if (queryInput) {
      conditions.push(
        ilike(
          productCompletionDescriptions.value,
          `%${escapeLikePattern(queryInput)}%`,
        ),
      );
    }
    const predicate = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (input.page - 1) * input.count;
    const [countResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(productCompletionDescriptions)
        .where(predicate),
      this.db
        .select({ value: productCompletionDescriptions.value })
        .from(productCompletionDescriptions)
        .where(predicate)
        // No Lucene relevance under PG — most-recently-used approximates it.
        .orderBy(desc(productCompletionDescriptions.lastUsedAt))
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countResult[0]?.total ?? 0;
    return {
      total,
      hasMore: offset + rows.length < total,
      items: rows.map((r) => r.value),
    };
  }

  // ── PnP sync/extraction helpers (exercised on PnP upload — File domain) ──

  async listIdsAndScriptureRefs(engagementId: ID) {
    const rows = await this.db
      .select({
        id: products.id,
        pnpIndex: products.pnpIndex,
        scriptureReferences: products.scriptureReferences,
        book: products.unspecifiedScriptureBook,
        totalVerses: products.unspecifiedScriptureTotalVerses,
      })
      .from(products)
      .where(
        and(
          eq(products.engagementId, engagementId),
          eq(products.type, 'DirectScripture'),
          isNull(products.deletedAt),
        ),
      );
    return rows.map((row) => ({
      id: row.id as ID,
      pnpIndex: row.pnpIndex ?? undefined,
      scriptureRanges: row.scriptureReferences,
      unspecifiedScripture:
        row.book != null && row.totalVerses != null
          ? { book: row.book, totalVerses: row.totalVerses }
          : null,
    }));
  }

  async listIdsWithPnpIndexes(engagementId: ID, type?: string) {
    const conditions: SQL[] = [
      eq(products.engagementId, engagementId),
      isNotNull(products.pnpIndex),
      isNull(products.deletedAt),
    ];
    const mapped = type ? PRODUCT_TYPE_BY_LABEL[type] : undefined;
    // An unrecognized label matches nothing on Neo4j (label filter), so an
    // unmapped type must return empty rather than silently dropping the filter.
    if (type && !mapped) {
      return [];
    }
    if (mapped) {
      conditions.push(eq(products.type, mapped));
    }
    const rows = await this.db
      .select({ id: products.id, pnpIndex: products.pnpIndex })
      .from(products)
      .where(and(...conditions));
    return rows.map((row) => ({
      id: row.id as ID,
      pnpIndex: row.pnpIndex!,
    }));
  }

  async listIdsWithProducibleNames(engagementId: ID, type?: ProducibleType) {
    const producibleType = PRODUCIBLE_TYPES.find((t) => t === type);
    if (type && !producibleType) {
      // A concrete-product type was passed — no producible rows carry it.
      return [];
    }
    const rows = await this.db
      .select({ id: products.id, name: producibles.name })
      .from(products)
      .innerJoin(producibles, eq(products.producesId, producibles.id))
      .where(
        and(
          eq(products.engagementId, engagementId),
          isNull(products.deletedAt),
          producibleType ? eq(producibles.type, producibleType) : undefined,
        ),
      );
    return rows.map((row) => ({ id: row.id as ID, name: row.name }));
  }

  async getProducibleIdsByNames(
    names: readonly string[],
    type?: ProducibleType,
  ) {
    const producibleType = PRODUCIBLE_TYPES.find((t) => t === type);
    if (type && !producibleType) {
      return [];
    }
    const rows = await this.db
      .select({ id: producibles.id, name: producibles.name })
      .from(producibles)
      .where(
        and(
          inArray(producibles.name, [...names]),
          isNull(producibles.deletedAt),
          producibleType ? eq(producibles.type, producibleType) : undefined,
        ),
      );
    return rows.map((row) => ({ id: row.id as ID, name: row.name }));
  }
}
