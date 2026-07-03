import { ethnologueLanguages } from '~/core/drizzle/schema';
import { type EthnologueLanguage } from '../../../components/language/dto';
import { EthnologueLanguageRepository } from '../../../components/language/ethnologue-language/ethnologue-language.repository';
import { bulkInsert, one, readAllViaRepo } from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * EthnologueLanguage — leaf (code, provisionalCode, name, population).
 *
 * migration-todo: `language_id` is left null here. It's a deferred plain-text
 * column (no FK) until Language migrates; the id lives on the Neo4j *Language*
 * side (`(Language)-[:ethnologue]->(Ethnologue.Language)`), so backfill it in
 * the Language wave's extractor (or a reverse-lookup pass) once `languages` is
 * on Postgres.
 */
export const ethnologueExtractor: Extractor = {
  name: 'ethnologue',
  targetTables: ['ethnologue_languages'],
  async run(ctx) {
    const dtos = await readAllViaRepo<EthnologueLanguage>(
      ctx,
      'Ethnologue.Language',
      EthnologueLanguageRepository,
    );
    // EthnologueLanguage is an embedded value type (no Resource createdAt on
    // the Neo4j side); let the table's createdAt/updatedAt defaults apply.
    const rows = dtos.map((e) => ({
      id: e.id,
      languageId: null,
      code: e.code ?? null,
      provisionalCode: e.provisionalCode ?? null,
      name: e.name ?? null,
      population: e.population ?? null,
      deletedAt: null,
    }));
    return one(
      'ethnologue_languages',
      dtos.length,
      await bulkInsert(ctx, ethnologueLanguages, rows),
    );
  },
};
