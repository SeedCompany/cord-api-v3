import { type ID } from '~/common';
import {
  engagements,
  producibles,
  producibleTypeEnum,
  productCompletionDescriptions,
  productMediumEnum,
  productMethodologyEnum,
  productPurposeEnum,
  products,
  productStepEnum,
  progressMeasurementEnum,
} from '~/core/drizzle/schema';
import {
  type HydratedProductRow,
  ProductRepository,
} from '../../../components/product/product.repository';
import {
  bulkInsert,
  cypher,
  fetchIds,
  liveTargetIds,
  orDefault,
  readAllRowsViaRepo,
  sanitizeEnum,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/** A verse-id range exactly as both engines store it. */
interface VerseRange {
  start: number;
  end: number;
}

/**
 * Product family — producibles (Film/Story/EthnoArt in one table) + products
 * (single-table inheritance over Direct/Derivative/Other) +
 * product_completion_descriptions.
 *
 * ⚠ DO NOT ENUMERATE THE `Producible` LABEL. In Neo4j, **Products carry it too** —
 * locally `MATCH (n:Producible)` returns 477 nodes of which 444 are Products
 * (411 DirectScriptureProduct + 33 DerivativeScriptureProduct) and only 33 are
 * real producibles. Reading that label would insert every Product into the
 * `producibles` table. Producibles are enumerated by their CONCRETE labels
 * instead. This is the same family of trap as the ethnologue label bug, inverted:
 * the label exists and matches too much rather than nothing.
 *
 * Scripture ranges are read STRAIGHT off the `ScriptureRange` nodes, whose
 * `start`/`end` are already the verse-id integers the jsonb columns want. Going
 * through the DTO instead would mean a lossy round trip out to
 * book/chapter/verse and back via ScriptureRange.fromReferences.
 *
 * `products_type_shape_chk` forces drops rather than nulls, as with engagements:
 *   DirectScripture ⟹ produces_id NULL     AND title NULL
 *   Derivative      ⟹ produces_id NOT NULL AND title NULL
 *   Other           ⟹ title NOT NULL       AND produces_id NULL
 */
export const productExtractor: Extractor = {
  name: 'product',
  targetTables: ['producibles', 'products', 'product_completion_descriptions'],
  dependsOn: ['engagement'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    // ── producibles ─────────────────────────────────────────────────────────
    // Concrete labels only — see the docblock.
    const producibleRows: Array<{
      id: ID;
      type: 'Film' | 'Story' | 'EthnoArt';
      name: string;
      createdAt: Date;
    }> = [];
    for (const type of producibleTypeEnum.enumValues) {
      const rows = await cypher<{ id: ID; name: string; createdAt: string }>(
        ctx,
        `MATCH (p:\`${type}\`)-[:name { active: true }]->(n:Property)
         RETURN p.id AS id, n.value AS name, toString(p.createdAt) AS createdAt`,
      );
      // A label with no nodes is fine here (Film/EthnoArt are empty locally),
      // but an unknown label would also be silent — fetchIds' guard covers the
      // repo-driven paths, so assert the label is real by enumerating it too.
      if (rows.length === 0) {
        await fetchIds(ctx, type);
      }
      for (const row of rows) {
        producibleRows.push({
          id: row.id,
          type,
          name: row.name,
          createdAt: new Date(row.createdAt),
        });
      }
    }
    // Producibles are read by raw Cypher (no repo), so fetch their ranges the
    // same way — one batched query, then group by owner. Products get theirs off
    // the hydrated row instead.
    const producibleIds = new Set<string>(producibleRows.map((row) => row.id));
    const producibleRefs = new Map<string, VerseRange[]>();
    if (producibleIds.size > 0) {
      const refRows = await cypher<{
        ownerId: ID;
        start: number;
        end: number;
      }>(
        ctx,
        `MATCH (o)-[:scriptureReferences { active: true }]->(s:ScriptureRange)
         WHERE o:Film OR o:Story OR o:EthnoArt
         RETURN o.id AS ownerId, s.start AS start, s.end AS end`,
      );
      for (const row of refRows) {
        if (!producibleIds.has(row.ownerId)) continue;
        const list = producibleRefs.get(row.ownerId) ?? [];
        list.push({ start: Number(row.start), end: Number(row.end) });
        producibleRefs.set(row.ownerId, list);
      }
      for (const list of producibleRefs.values()) {
        list.sort((a, b) => a.start - b.start || a.end - b.end);
      }
    }
    out.producibles = stat(
      producibleRows.length,
      await bulkInsert(
        ctx,
        producibles,
        producibleRows.map((row) => ({
          id: row.id,
          type: row.type,
          name: row.name,
          scriptureReferences: producibleRefs.get(row.id) ?? [],
          createdAt: row.createdAt,
          updatedAt: row.createdAt,
          deletedAt: null,
        })),
      ),
    );

    // ── products ────────────────────────────────────────────────────────────
    // HydratedProductRow, not UnsecuredDto<Product> — it carries `isOverriding`
    // and the raw ScriptureRange nodes, both of which the DTO drops.
    const dtos = await readAllRowsViaRepo<HydratedProductRow>(
      ctx,
      'Product',
      ProductRepository,
    );
    const derivativeIds = new Set<string>(
      await fetchIds(ctx, 'DerivativeScriptureProduct'),
    );
    const otherIds = new Set<string>(await fetchIds(ctx, 'OtherProduct'));

    const landedEngagements = await liveTargetIds(
      ctx,
      'Engagement',
      engagements,
    );
    // Can't use liveTargetIds here: its dry-run fallback takes ONE label, and
    // producibles span three (with `Producible` itself unusable — it matches
    // Products). Build from what this extractor just wrote instead.
    const landedProducibles = ctx.dryRun
      ? new Set<string>(producibleRows.map((row) => row.id))
      : new Set(
          (await ctx.db.select({ id: producibles.id }).from(producibles)).map(
            (row) => String(row.id),
          ),
        );

    const droppedForEngagement: string[] = [];
    const droppedForProduces: string[] = [];
    const untitledOther: string[] = [];
    const unpairedUnspecified: string[] = [];
    const droppedEnums = new Set<string>();

    const productRows = dtos.flatMap((prod) => {
      const dto = prod as unknown as Record<string, any>;
      const engagementId = dto.engagement as ID<'Engagement'> | undefined;
      if (!engagementId || !landedEngagements.has(engagementId)) {
        droppedForEngagement.push(prod.id);
        return [];
      }

      const isDerivative = derivativeIds.has(prod.id);
      const isOther = otherIds.has(prod.id);
      const type: 'DirectScripture' | 'Derivative' | 'Other' = isDerivative
        ? 'Derivative'
        : isOther
          ? 'Other'
          : 'DirectScripture';

      // Derivative REQUIRES produces_id — the CHECK gives no null option.
      let producesId: ID | null = null;
      if (isDerivative) {
        producesId = (dto.produces?.id as ID | undefined) ?? null;
        if (!producesId || !landedProducibles.has(producesId)) {
          droppedForProduces.push(prod.id);
          return [];
        }
      }

      // Other REQUIRES a title. Rather than drop the row (products are the FK
      // parent of product_progress, so a drop loses real progress history), fill
      // a visible marker and shout — same call as the Language name fallback.
      let title: string | null = isOther
        ? ((dto.title as string | null) ?? null)
        : null;
      if (isOther && !title) {
        title = `(untitled product ${prod.id})`;
        untitledOther.push(prod.id);
      }

      // products_unspecified_scripture_chk: both columns or neither.
      let unspecifiedBook =
        (dto.unspecifiedScripture?.book as string | null) ?? null;
      let unspecifiedVerses =
        (dto.unspecifiedScripture?.totalVerses as number | null) ?? null;
      if ((unspecifiedBook == null) !== (unspecifiedVerses == null)) {
        unspecifiedBook = null;
        unspecifiedVerses = null;
        unpairedUnspecified.push(prod.id);
      }

      const mediums = sanitizeEnum(
        [...((dto.mediums as string[] | undefined) ?? [])],
        productMediumEnum.enumValues,
      );
      const purposes = sanitizeEnum(
        [...((dto.purposes as string[] | undefined) ?? [])],
        productPurposeEnum.enumValues,
      );
      const steps = sanitizeEnum(
        [...((dto.steps as string[] | undefined) ?? [])],
        productStepEnum.enumValues,
      );
      const methodology = dto.methodology
        ? sanitizeEnum(
            [dto.methodology as string],
            productMethodologyEnum.enumValues,
          )
        : { kept: [], dropped: [] as string[] };
      const measurement = sanitizeEnum(
        [orDefault(dto.progressStepMeasurement as string, 'Percent')],
        progressMeasurementEnum.enumValues,
      );
      for (const [label, result] of [
        ['medium', mediums],
        ['purpose', purposes],
        ['step', steps],
        ['methodology', methodology],
        ['progressStepMeasurement', measurement],
      ] as const) {
        for (const value of result.dropped) {
          droppedEnums.add(`${label}=${value}`);
        }
      }

      // The hydrate already returns the OWN list under `scriptureReferences`,
      // picking the right relationship per subtype (`scriptureReferences` for
      // direct, `scriptureReferencesOverride` for derivative) — see
      // product.repository.ts:229-239. So this is the own list either way.
      const ownRanges = rangesOf(dto.scriptureReferences);
      // For a derivative, null (NOT []) is what encodes "not overriding": the
      // column REPLACES Neo4j's isOverriding flag, so an empty array would mean
      // "overriding with nothing" and would hide the producible's references.
      const override = isDerivative
        ? dto.isOverriding
          ? ownRanges
          : null
        : null;

      return [
        {
          id: prod.id,
          engagementId,
          type: type,
          mediums: mediums.kept as any,
          purposes: purposes.kept as any,
          methodology: (methodology.kept[0] as any) ?? null,
          steps: steps.kept as any,
          describeCompletion: (dto.describeCompletion as string | null) ?? null,
          placeholderDescription:
            (dto.placeholderDescription as string | null) ?? null,
          progressStepMeasurement: (measurement.kept[0] as any) ?? 'Percent',
          progressTarget: orDefault(dto.progressTarget as number, 100),
          scriptureReferences: isDerivative ? [] : ownRanges,
          scriptureReferencesOverride: override,
          unspecifiedScriptureBook: unspecifiedBook,
          unspecifiedScriptureTotalVerses: unspecifiedVerses,
          totalVerses: orDefault(dto.totalVerses as number, 0),
          totalVerseEquivalents: orDefault(
            dto.totalVerseEquivalents as number,
            0,
          ),
          producesId,
          composite: isDerivative
            ? ((dto.composite as boolean | null) ?? null)
            : null,
          title,
          description: isOther
            ? ((dto.description as string | null) ?? null)
            : null,
          pnpIndex: (dto.pnpIndex as number | null) ?? null,
          createdAt: tsReq(prod.createdAt),
          updatedAt: tsReq(prod.createdAt),
          deletedAt: null,
        },
      ];
    });

    if (droppedForEngagement.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForEngagement.length} product(s) whose engagement never landed: ` +
          `${droppedForEngagement.slice(0, 10).join(', ')}${droppedForEngagement.length > 10 ? ', …' : ''}`,
      );
    }
    if (droppedForProduces.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForProduces.length} derivative product(s) whose producible never landed ` +
          `(type-shape CHECK forbids a null produces_id): ` +
          `${droppedForProduces.slice(0, 10).join(', ')}${droppedForProduces.length > 10 ? ', …' : ''}`,
      );
    }
    if (untitledOther.length > 0) {
      ctx.log(
        `    ⚠ ${untitledOther.length} OtherProduct(s) had no title under a CHECK that requires one — ` +
          `filled with a visible marker, needs a data fix: ${untitledOther.slice(0, 10).join(', ')}`,
      );
    }
    if (unpairedUnspecified.length > 0) {
      ctx.log(
        `    ⚠ ${unpairedUnspecified.length} product(s) had only one half of the unspecified-scripture pair ` +
          `(book XOR totalVerses) — both nulled to satisfy the CHECK: ${unpairedUnspecified.slice(0, 10).join(', ')}`,
      );
    }
    if (droppedEnums.size > 0) {
      ctx.log(
        `    ⚠ dropped unknown product enum value(s): ${[...droppedEnums].join(', ')} — migration-todo: map, don't drop`,
      );
    }

    out.products = stat(
      dtos.length,
      await bulkInsert(ctx, products, productRows),
    );

    // ── product_completion_descriptions ─────────────────────────────────────
    // Suggestion store, not a domain entity: id is a bigserial, so let Postgres
    // assign it and dedupe on (value, methodology).
    const descRows = await cypher<{
      value: string;
      methodology: string;
      lastUsedAt: string | null;
      createdAt: string | null;
    }>(
      ctx,
      `MATCH (d:ProductCompletionDescription)
       RETURN d.value AS value, d.methodology AS methodology,
              toString(d.lastUsedAt) AS lastUsedAt, toString(d.createdAt) AS createdAt`,
    );
    const knownMethodologies = new Set<string>(
      productMethodologyEnum.enumValues,
    );
    const seenDesc = new Set<string>();
    const descKept = descRows.filter((row) => {
      if (!row.value || !knownMethodologies.has(row.methodology)) return false;
      const key = `${row.value}::${row.methodology}`;
      if (seenDesc.has(key)) return false;
      seenDesc.add(key);
      return true;
    });
    if (descKept.length !== descRows.length) {
      ctx.log(
        `    ⚠ skipped ${descRows.length - descKept.length} completion description(s) — blank value, ` +
          `unknown methodology, or a (value, methodology) duplicate`,
      );
    }
    out.product_completion_descriptions = stat(
      descRows.length,
      await bulkInsert(
        ctx,
        productCompletionDescriptions,
        descKept.map((row) => ({
          value: row.value,
          methodology: row.methodology as any,
          lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : new Date(),
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        })),
      ),
    );

    return out;
  },
};

/**
 * ScriptureRange nodes → the plain `{start, end}` verse-id pairs the jsonb
 * columns hold. Both engines already store verse ids, so this is a shape unwrap
 * (`node.properties`), NOT a conversion — deliberately avoiding a round trip out
 * to book/chapter/verse and back through ScriptureRange.fromReferences.
 *
 * Sorted so a re-run produces byte-identical jsonb.
 */
const rangesOf = (nodes: unknown): VerseRange[] => {
  const list = Array.isArray(nodes) ? nodes : [];
  return list
    .map((node: any) => {
      const props = node?.properties ?? node ?? {};
      return { start: Number(props.start), end: Number(props.end) };
    })
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end))
    .sort((a, b) => a.start - b.start || a.end - b.end);
};
