import { type ID } from '~/common';
import {
  periodicReports,
  productProgress,
  products,
  productStepEnum,
  stepProgress,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  recordReadLoss,
  sanitizeEnum,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * ProductProgress + StepProgress — reported completion per
 * (product, report, variant), with one step row per step actually reported.
 *
 * No repository read here, deliberately. ProductProgressRepository has no
 * `readMany(ids)` — every read is keyed by (product, report, variant) and its
 * hydrate SYNTHESIZES placeholder step rows for the product's declared-but-
 * unreported steps (product-progress.repository.ts hydrateOne). Those
 * placeholders are a read-time convenience, not stored data, and going through
 * that path would invent step rows the source never had. So this reads the nodes
 * directly.
 *
 * `completed` is nullable and very often null — 788 of 1391 step rows locally.
 * A step row with no value is meaningful (the step was touched, no figure
 * recorded), so those are carried rather than skipped.
 *
 * Both FKs are NOT NULL, so a progress row whose product or report never landed
 * has to be dropped. Neo4j keeps progress hanging off soft-deleted parents
 * (locally 5 under deleted products, 1 under a deleted report), and the product
 * wave itself drops rows, so this is a real and recurring class.
 */
export const productProgressExtractor: Extractor = {
  name: 'product-progress',
  targetTables: ['product_progress', 'step_progress'],
  dependsOn: ['product', 'periodic-report'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    // ── product_progress ──────────────────────────────────────────────────────
    const progressRows = await cypher<{
      id: ID;
      productId: ID<'Product'>;
      reportId: ID;
      variant: string;
      createdAt: string;
    }>(
      ctx,
      `MATCH (product:Product)-[:progress { active: true }]->(progress:ProductProgress)
             <-[:progress { active: true }]-(report:PeriodicReport)
       RETURN progress.id AS id, product.id AS productId, report.id AS reportId,
              progress.variant AS variant, toString(progress.createdAt) AS createdAt`,
    );
    // Enumerate independently: the match above is an inner join through two
    // required edges, so nodes whose product or report is soft-deleted simply
    // vanish from it. Without this the loss reconciles ✓.
    const allProgressIds = await fetchIds(ctx, 'ProductProgress');
    recordReadLoss(
      ctx,
      'ProductProgress',
      allProgressIds.length - progressRows.length,
      `${progressRows.length} of ${allProgressIds.length} had both a live product and a live ` +
        `report, the rest hang off a soft-deleted parent`,
    );

    const landedProducts = await liveTargetIds(ctx, 'Product', products);
    const landedReports = await liveTargetIds(
      ctx,
      'PeriodicReport',
      periodicReports,
    );
    const progressKept = keepLanded(progressRows, [
      [landedProducts, (row) => row.productId],
      [landedReports, (row) => row.reportId],
    ]);
    if (progressKept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${progressKept.skipped} progress row(s) whose product or report never landed ` +
          `(both FKs are NOT NULL) — their step rows go with them`,
      );
    }

    out.product_progress = stat(
      progressRows.length,
      await bulkInsert(
        ctx,
        productProgress,
        progressKept.kept.map((row) => ({
          id: row.id,
          productId: row.productId,
          reportId: row.reportId,
          variant: row.variant,
          createdAt: tsReq(row.createdAt),
          updatedAt: tsReq(row.createdAt),
        })),
      ),
    );

    // ── step_progress ─────────────────────────────────────────────────────────
    const stepRows = await cypher<{
      id: ID;
      progressId: ID;
      step: string;
      completed: number | null;
      createdAt: string;
    }>(
      ctx,
      `MATCH (progress:ProductProgress)-[:step { active: true }]->(step:StepProgress)
       OPTIONAL MATCH (step)-[:completed { active: true }]->(value:Property)
       RETURN step.id AS id, progress.id AS progressId, step.step AS step,
              value.value AS completed, toString(step.createdAt) AS createdAt`,
    );

    // In a REAL run this must be Postgres truth, not the pre-insert kept set:
    // `product_progress_product_report_variant_unique` can conflict-drop a row
    // that `progressKept` believes landed, and its step rows would then pass this
    // guard and FK-abort the whole load. Dry-run is the only case where the kept
    // set is right — nothing was inserted, and liveTargetIds' own dry-run
    // fallback enumerates every Neo4j node including the parents just dropped.
    const landedProgress = ctx.dryRun
      ? new Set<string>(progressKept.kept.map((row) => row.id))
      : await liveTargetIds(ctx, 'ProductProgress', productProgress);
    const stepsKept = keepLanded(stepRows, [
      [landedProgress, (row) => row.progressId],
    ]);
    if (stepsKept.skipped > 0) {
      // Split by CAUSE. The step read above anchors on `(progress:ProductProgress)`
      // with no liveness constraint, so it returns steps for every progress node in
      // the graph — including the ones the progress read inner-joined away because
      // their product or report is soft-deleted. Those are the overwhelming
      // majority, and reporting the whole gap as "belonging to a dropped progress
      // row" points at the wrong thing: on the 2026-08-19 production run it read as
      // 82,664 steps lost to 283 dropped rows (292 each, against an average of 4.3)
      // when in fact ~19,535 unread progress nodes accounted for nearly all of it.
      const readProgressIds = new Set(progressRows.map((row) => row.id));
      const lostToSoftDeletedParent = stepRows.filter(
        (row) =>
          !landedProgress.has(row.progressId) &&
          !readProgressIds.has(row.progressId),
      ).length;
      const lostToGuard = stepsKept.skipped - lostToSoftDeletedParent;
      ctx.log(
        `    ⚠ DROPPED ${stepsKept.skipped} step row(s): ${lostToSoftDeletedParent} under a progress ` +
          `node whose product or report is soft-deleted (never read — the live-only policy working), ` +
          `${lostToGuard} under a progress row this wave dropped or that failed to land`,
      );
    }

    const droppedSteps: string[] = [];
    const stepValues = stepsKept.kept.flatMap((row) => {
      const step = sanitizeEnum([row.step], productStepEnum.enumValues);
      if (!step.kept[0]) {
        droppedSteps.push(`${row.id} (${row.step})`);
        return [];
      }
      return [
        {
          id: row.id,
          progressId: row.progressId,
          step: step.kept[0],
          completed: row.completed == null ? null : Number(row.completed),
          createdAt: tsReq(row.createdAt),
          updatedAt: tsReq(row.createdAt),
        },
      ];
    });
    if (droppedSteps.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${droppedSteps.length} step row(s) naming a step outside the product_step enum: ` +
          `${droppedSteps.slice(0, 10).join(', ')} — migration-todo: map, don't drop`,
      );
    }

    out.step_progress = stat(
      stepRows.length,
      await bulkInsert(ctx, stepProgress, stepValues),
    );

    return out;
  },
};
