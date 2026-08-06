import { type ID } from '~/common';
import {
  knownLanguages,
  languageProficiencyEnum,
  languages,
  users,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  sanitizeEnum,
  ts,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * KnownLanguages — which languages a user knows, at what proficiency.
 *
 * Edge-stored like pins, but with the proficiency ON the edge:
 * `(:User)-[:knownLanguage { active, createdAt, value }]->(:Language)`, where
 * `value` is the proficiency. There is no node to enumerate.
 *
 * ⚠ **This domain has ZERO edges in the local graph — the rel type is not even in
 * `db.relationshipTypes()`.** So a correct query and a typo'd one produce
 * byte-identical output, and reconciliation says `0 == 0 == 0 ✓` either way. The
 * rel-type guard is the only thing standing between those two outcomes here, which
 * is precisely why it was added. The type name is taken from
 * KnownLanguageRepository.create, not guessed.
 *
 * Unlike pins, the edge DOES carry `active` — removal deactivates rather than
 * deletes (KnownLanguageRepository.delete sets `rel.active = false`), so the
 * filter is load-bearing: without it, every proficiency a user ever had would be
 * migrated as current.
 *
 * The PK spans all three columns because a user may legitimately know one language
 * at more than one proficiency — the Neo4j create only replaces the exact
 * (user, language, proficiency) edge.
 */
export const knownLanguageExtractor: Extractor = {
  name: 'known-language',
  targetTables: ['known_languages'],
  dependsOn: ['user', 'language'],
  async run(ctx) {
    const rows = await cypher<{
      userId: ID<'User'>;
      languageId: ID<'Language'>;
      proficiency: string | null;
      createdAt: string | null;
    }>(
      ctx,
      `MATCH (user:User)-[rel:knownLanguage { active: true }]->(language:Language)
       RETURN user.id AS userId, language.id AS languageId,
              rel.value AS proficiency, toString(rel.createdAt) AS createdAt`,
    );
    if (rows.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'knownLanguage');
    }

    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const landedLanguages = await liveTargetIds(ctx, 'Language', languages);
    const kept = keepLanded(rows, [
      [landedUsers, (row) => row.userId],
      [landedLanguages, (row) => row.languageId],
    ]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} known-language row(s) whose user or language never landed ` +
          `(both FKs) — language drops are the unique-dup cascade, see README finding #6`,
      );
    }

    const seen = new Set<string>();
    const droppedProficiencies = new Set<string>();
    const values = kept.kept.flatMap((row) => {
      const proficiency = sanitizeEnum(
        [String(row.proficiency)],
        languageProficiencyEnum.enumValues,
      );
      if (!proficiency.kept[0]) {
        droppedProficiencies.add(String(row.proficiency));
        return [];
      }
      const key = `${row.userId}::${row.languageId}::${proficiency.kept[0]}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          userId: row.userId,
          languageId: row.languageId,
          proficiency: proficiency.kept[0],
          createdAt: ts(row.createdAt) ?? new Date(),
        },
      ];
    });
    if (droppedProficiencies.size > 0) {
      ctx.log(
        `    ⚠ DROPPED row(s) with a proficiency outside the language_proficiency enum: ` +
          `${[...droppedProficiencies].join(', ')} — migration-todo: map, don't drop`,
      );
    }

    return one(
      'known_languages',
      rows.length,
      await bulkInsert(ctx, knownLanguages, values),
    );
  },
};
