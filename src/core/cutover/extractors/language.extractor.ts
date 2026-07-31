import { eq, inArray } from 'drizzle-orm';
import { type ID } from '~/common';
import { ethnologueLanguages, languages } from '~/core/drizzle/schema';
import { type Language } from '../../../components/language/dto';
import { LanguageRepository } from '../../../components/language/language.repository';
import {
  bulkInsert,
  dateStr,
  orDefault,
  readAllViaRepo,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Language — the FK root for Engagement, and the wave that closes the
 * `ethnologue_languages.language_id` deferral the ethnologue extractor left
 * open (its comment points here).
 *
 * Only STORED columns are written. `presetInventory`, `usesAIAssistance`,
 * `firstScriptureEngagement` and `effectiveSensitivity` all appear on the
 * hydrated DTO but are DERIVED from engaged projects at read time and have no
 * column — writing them would invent state.
 *
 * `sensitivity` is the user-settable column, NOT the computed one. The Neo4j
 * hydrate merges `props`, so `dto.sensitivity` is the stored property;
 * `effectiveSensitivity` is a separate DTO field the hydrate computes in a
 * subquery. Getting these backwards would silently overwrite each language's
 * own setting with the lowest sensitivity across its projects.
 *
 * ⚠ `--only=language` ALONE IS UNSAFE. The harness truncates target tables with
 * CASCADE, and `ethnologue_languages.language_id` references `languages.id`, so
 * truncating `languages` truncates the ethnologue rows this wave then wants to
 * backfill. Use `--only=ethnologue,language`.
 */
export const languageExtractor: Extractor = {
  name: 'language',
  targetTables: ['languages'],
  dependsOn: ['ethnologue'],
  async run(ctx) {
    const dtos = await readAllViaRepo<Language>(
      ctx,
      'Language',
      LanguageRepository,
    );

    // NOT NULL guard (prod-finding #1 class: null-in-NOT-NULL). `name` and
    // `displayName` are NOT NULL with no schema default, and Language is an FK
    // PARENT of engagements — dropping a row here would orphan real work. So
    // fall back to the sibling name field (one of the pair is almost always
    // present), and only as a last resort to the id, which is visible in the UI
    // and trivially correctable by a data fix. Never silent.
    let namesFilled = 0;
    let idFallbacks = 0;
    const nameOf = (
      primary: string | null | undefined,
      sibling: string | null | undefined,
      id: ID,
    ): string => {
      if (primary) return primary;
      namesFilled++;
      if (sibling) return sibling;
      idFallbacks++;
      return id;
    };

    const rows = dtos.map((lang) => ({
      id: lang.id,
      name: nameOf(lang.name, lang.displayName, lang.id),
      displayName: nameOf(lang.displayName, lang.name, lang.id),
      displayNamePronunciation: lang.displayNamePronunciation ?? null,
      // Stored value — see the docblock. NOT effectiveSensitivity.
      sensitivity: orDefault(lang.sensitivity, 'High'),
      isDialect: orDefault(lang.isDialect, false),
      populationOverride: lang.populationOverride ?? null,
      registryOfLanguageVarietiesCode:
        lang.registryOfLanguageVarietiesCode ?? null,
      leastOfThese: orDefault(lang.leastOfThese, false),
      leastOfTheseReason: lang.leastOfTheseReason ?? null,
      isSignLanguage: orDefault(lang.isSignLanguage, false),
      signLanguageCode: lang.signLanguageCode ?? null,
      sponsorEstimatedEndDate: dateStr(lang.sponsorEstimatedEndDate),
      hasExternalFirstScripture: orDefault(
        lang.hasExternalFirstScripture,
        false,
      ),
      tags: lang.tags ? [...lang.tags] : [],
      isAvailableForReporting: orDefault(lang.isAvailableForReporting, false),
      createdAt: tsReq(lang.createdAt),
      // Language carries no modifiedAt (Resource gives only createdAt), so
      // updatedAt mirrors it — same as fieldZone/fieldRegion/location.
      updatedAt: tsReq(lang.createdAt),
      deletedAt: null,
    }));
    if (namesFilled > 0) {
      ctx.log(
        `    ⚠ ${namesFilled} language name/displayName value(s) were null under a NOT NULL column — ` +
          `filled from the sibling field` +
          (idFallbacks > 0
            ? `, and ${idFallbacks} from the id because BOTH were null (needs a data fix)`
            : ''),
      );
    }

    // Unique-dup pre-warning (prod-finding #3 class). The ROLV code is the one
    // remaining partial unique on this table, it scopes to live rows, and every
    // row this wave writes is live — so a duplicate among them is silently
    // swallowed by onConflictDoNothing and the reconciliation count alone won't
    // say which. Surface it before inserting.
    //
    // `name` and `displayName` were checked here too until migration 0030 dropped
    // their unique indexes. Leaving them in printed "19 language(s) … will be
    // DROPPED" on every run while all 69 loaded fine — a warning that is not true
    // is worse than no warning, because it teaches the reader to skim the ⚠ lines
    // that are.
    for (const [label, key] of [
      [
        'registryOfLanguageVarietiesCode',
        (r: (typeof rows)[number]) => r.registryOfLanguageVarietiesCode,
      ],
    ] as const) {
      const seen = new Map<string, ID>();
      const collisions: string[] = [];
      for (const row of rows) {
        const value = key(row);
        if (value == null) continue;
        const first = seen.get(value);
        if (first) collisions.push(`${row.id} (dup of ${first})`);
        else seen.set(value, row.id);
      }
      if (collisions.length > 0) {
        ctx.log(
          `    ⚠ ${collisions.length} language(s) collide on the ${label} live-unique index and will be ` +
            `DROPPED by onConflictDoNothing: ${collisions.slice(0, 10).join(', ')}` +
            (collisions.length > 10 ? ', …' : ''),
        );
      }
    }

    const inserted = await bulkInsert(ctx, languages, rows);

    // Pass 2 — close the ethnologue deferral. The FK lives on the OTHER table
    // (ethnologue_languages.language_id), which the ethnologue extractor owns,
    // so this is an UPDATE and `ethnologue_languages` is deliberately NOT in
    // targetTables: declaring it would truncate it twice and double-count it in
    // reconciliation. The extra stat key below is logged but not reconciled.
    let linked = 0;
    let danglingEthnologue = 0;
    const pairs = dtos.flatMap((lang) => {
      const ethId = lang.ethnologue?.id;
      return ethId ? [{ languageId: lang.id, ethId }] : [];
    });
    if (!ctx.dryRun && pairs.length > 0) {
      // Only target ethnologue rows that actually landed, and languages that
      // actually landed — either side can be missing via onConflictDoNothing.
      const presentEth = new Set(
        (
          await ctx.db
            .select({ id: ethnologueLanguages.id })
            .from(ethnologueLanguages)
            .where(
              inArray(
                ethnologueLanguages.id,
                pairs.map((p) => p.ethId),
              ),
            )
        ).map((row) => row.id),
      );
      const presentLangs = new Set(
        (await ctx.db.select({ id: languages.id }).from(languages)).map(
          (row) => row.id,
        ),
      );
      for (const pair of pairs) {
        if (!presentEth.has(pair.ethId) || !presentLangs.has(pair.languageId)) {
          danglingEthnologue++;
          continue;
        }
        await ctx.db
          .update(ethnologueLanguages)
          .set({ languageId: pair.languageId })
          .where(eq(ethnologueLanguages.id, pair.ethId));
        linked++;
      }
      if (danglingEthnologue > 0) {
        ctx.log(
          `    ⚠ ${danglingEthnologue} ethnologue↔language link(s) skipped — one side never landed`,
        );
      }
    }

    return {
      languages: stat(dtos.length, inserted),
      // Not a target table — reported for visibility, not reconciled.
      'ethnologue_languages.language_id (backfill)': stat(
        pairs.length,
        ctx.dryRun ? 0 : linked,
      ),
    };
  },
};
