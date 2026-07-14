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
    // CHECK-constraint guard (audit ETH1, prod-finding #1 class): the PG
    // format/range CHECKs have no Neo4j counterpart and DTO validators only
    // guarded NEW writes — one legacy bad value would abort a whole insert
    // chunk. The CHECKs are NULL-tolerant, so null + log instead of dropping.
    const CODE_RE = /^[a-z]{3}$/;
    let nulledValues = 0;
    const conform = (value: string | null | undefined): string | null => {
      if (value == null) return null;
      if (CODE_RE.test(value)) return value;
      nulledValues++;
      return null;
    };

    // EthnologueLanguage is an embedded value type (no Resource createdAt on
    // the Neo4j side); let the table's createdAt/updatedAt defaults apply.
    const rows = dtos.map((e) => {
      const population =
        e.population != null && e.population >= 0 ? e.population : null;
      if (e.population != null && population == null) nulledValues++;
      return {
        id: e.id,
        languageId: null,
        code: conform(e.code),
        provisionalCode: conform(e.provisionalCode),
        name: e.name ?? null,
        population,
        deletedAt: null,
      };
    });
    if (nulledValues) {
      ctx.log(
        `    ⚠ nulled ${nulledValues} ethnologue value(s) violating PG CHECK constraints (bad code format / negative population — audit ETH1)`,
      );
    }
    return one(
      'ethnologue_languages',
      dtos.length,
      await bulkInsert(ctx, ethnologueLanguages, rows),
    );
  },
};
