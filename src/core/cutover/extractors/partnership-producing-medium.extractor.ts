import { type ID } from '~/common';
import {
  engagements,
  partnershipProducingMediums,
  partnerships,
} from '~/core/drizzle/schema';
import { type ProductMedium } from '../../../components/product/dto';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Partnership producing mediums — which partnership is responsible for producing
 * each medium (print, audio, video …) on a language engagement.
 *
 * Edge-stored with the payload ON the edge, which makes it the odd one of the four.
 * There is no node and therefore no label to enumerate: the whole record is
 * `(:LanguageEngagement)-[:PartnershipProducingMedium { active, medium, createdAt }]->(:Partnership)`,
 * where the relationship TYPE is the resource name and `medium` is a relationship
 * property. Hence the explicit rel-type guard — a misspelling returns zero rows and
 * reconciles as a clean ✓.
 *
 * Only `active: true` edges are carried. Neo4j does not delete a reassignment, it
 * sets `active: false` and stamps `deletedAt`, so the inactive edges are the history
 * of previous assignments. Postgres deliberately does not model that history: the
 * table is a pure assignment with a composite primary key of
 * `(engagement_id, medium)` and no `deleted_at`, decided when the domain was ported
 * on the grounds that the audit trail now covers the "who changed this" need.
 * Carrying inactive edges here would violate that primary key.
 *
 * Both columns are real foreign keys, and only a live `LanguageEngagement` source
 * is carried — the label the repository requires. Everything else is read anyway
 * and reported, rather than filtered out in the Cypher where it would leave no
 * trace; see the classification step for why those are two different things.
 */
export const partnershipProducingMediumExtractor: Extractor = {
  name: 'partnership-producing-medium',
  targetTables: ['partnership_producing_mediums'],
  dependsOn: ['engagement', 'partnership'],
  async run(ctx) {
    const rows = await cypher<{
      engagementId: ID<'Engagement'>;
      medium: string | null;
      partnershipId: ID<'Partnership'>;
      createdAt: string | null;
      isLanguageEngagement: boolean;
      sourceDeleted: boolean;
    }>(
      ctx,
      // Deliberately NOT `(eng:LanguageEngagement)`. That exact-label match is what
      // the repository requires, and matching it here would be defensible — but it
      // would also make this extractor blind to every edge hanging off anything
      // else, which is the harness's worst failure shape: rows never read, so read
      // and inserted agree and the table reconciles with a clean tick while real
      // rows go missing. A production probe found a substantial set of exactly those
      // edges, so this is a live concern rather than a theoretical one. Read every
      // edge and let the classification below account for each one out loud.
      `MATCH (eng)-[rel:PartnershipProducingMedium { active: true }]->(partnership:Partnership)
       RETURN eng.id AS engagementId,
              rel.medium AS medium,
              partnership.id AS partnershipId,
              toString(rel.createdAt) AS createdAt,
              'LanguageEngagement' IN labels(eng) AS isLanguageEngagement,
              any(l IN labels(eng) WHERE l STARTS WITH 'Deleted_') AS sourceDeleted`,
    );
    if (rows.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'PartnershipProducingMedium');
    }

    // Account for every edge whose source is not a live LanguageEngagement, rather
    // than never reading it. Two distinct causes with opposite meanings, so they are
    // reported separately:
    //
    // - `sourceDeleted` — the engagement was removed. Soft delete prefixes every
    //   label, so `LanguageEngagement` becomes `Deleted_LanguageEngagement`. Correct
    //   to skip (the ETL is live-only) and expected in any real database.
    // - live but not a LanguageEngagement — should be impossible. The repository
    //   only ever creates these from a LanguageEngagement, so this means either an
    //   older code path made them or the data has drifted. A production probe found
    //   none of these, so this branch is a guard against drift rather than a known
    //   case — which is exactly why it logs loudly instead of being left out.
    const foreign = rows.filter((row) => !row.isLanguageEngagement);
    const foreignDeleted = foreign.filter((row) => row.sourceDeleted).length;
    const foreignLive = foreign.length - foreignDeleted;
    if (foreignDeleted > 0) {
      ctx.log(
        `    ⚠ DROPPED ${foreignDeleted} producing-medium assignment(s) under a ` +
          `soft-deleted engagement — correct, the ETL carries live rows only`,
      );
    }
    if (foreignLive > 0) {
      ctx.log(
        `    🔴 DROPPED ${foreignLive} producing-medium assignment(s) whose source is ` +
          `LIVE but carries no \`LanguageEngagement\` label. The repository only ` +
          `creates these from a language engagement, so this should not be possible — ` +
          `investigate the source edges before trusting this table.`,
      );
    }

    const languageEngagementRows = rows.filter(
      (row) => row.isLanguageEngagement,
    );

    const landedEngagements = await liveTargetIds(
      ctx,
      'LanguageEngagement',
      engagements,
    );
    const landedPartnerships = await liveTargetIds(
      ctx,
      'Partnership',
      partnerships,
    );
    const kept = keepLanded(languageEngagementRows, [
      [landedEngagements, (row) => row.engagementId],
      [landedPartnerships, (row) => row.partnershipId],
    ]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} producing-medium assignment(s) whose engagement ` +
          `or partnership never landed (both are real FKs, either would abort the load)`,
      );
    }

    // From the column, so it cannot drift from what Postgres accepts.
    const allowedMediums = new Set<string>(
      partnershipProducingMediums.medium.enumValues,
    );

    // Composite PK (engagement_id, medium). Neo4j's own `merge` plus the deactivate
    // step should make two active edges for one pair impossible, so a duplicate here
    // means that invariant has slipped — report it rather than letting the PK abort
    // the run.
    const seen = new Set<string>();
    const duplicated: string[] = [];
    const badMedium: string[] = [];
    const undated: string[] = [];
    const values = kept.kept.flatMap((row) => {
      // NOT NULL enum. An edge with no medium, or one the enum no longer lists,
      // would abort the load on a cast error.
      if (!row.medium || !allowedMediums.has(row.medium)) {
        badMedium.push(`${row.engagementId}:${row.medium ?? 'null'}`);
        return [];
      }
      const key = `${row.engagementId}::${row.medium}`;
      if (seen.has(key)) {
        duplicated.push(key);
        return [];
      }
      seen.add(key);
      if (!row.createdAt) undated.push(key);
      return [
        {
          engagementId: row.engagementId,
          medium: row.medium as ProductMedium,
          partnershipId: row.partnershipId,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        },
      ];
    });
    if (badMedium.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${badMedium.length} assignment(s) whose medium is missing or ` +
          `not a value the \`product_medium\` enum lists (NOT NULL enum column)`,
      );
    }
    if (duplicated.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${duplicated.length} duplicate (engagement, medium) pair(s) — ` +
          `two ACTIVE edges existed for one pair, which the merge/deactivate pair in ` +
          `PartnershipProducingMediumRepository.update is meant to prevent. Kept the ` +
          `first of each; investigate the source edges.`,
      );
    }
    if (undated.length > 0) {
      ctx.log(
        `    ⚠ ${undated.length} assignment(s) had no createdAt under a NOT NULL ` +
          `column — stamped now(). \`createdAt\` is set only ON CREATE, so an edge ` +
          `predating that code can lack it.`,
      );
    }

    const inserted = await bulkInsert(ctx, partnershipProducingMediums, values);
    return one('partnership_producing_mediums', rows.length, inserted);
  },
};
