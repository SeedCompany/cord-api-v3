import { Injectable } from '@nestjs/common';
import { ilike, type SQL } from 'drizzle-orm';
import { generateId, type ID, type UnsecuredDto } from '~/common';
import { DrizzleDtoRepository, escapeLikePattern } from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { ethnologueLanguages } from '~/core/drizzle/schema';
import {
  type CreateEthnologueLanguage,
  EthnologueLanguage,
  type EthnologueLanguageFilters,
  type UpdateEthnologueLanguage,
} from '../dto';

// No unique-violation mapping: neither `code` nor `provisional_code` is unique
// (migration 0030 — languages share ethnologue codes routinely), so there is no
// violation to map. The unique key is the ROLV code on `languages`.

@Injectable()
export class EthnologueLanguageDrizzleRepository extends DrizzleDtoRepository<
  typeof ethnologueLanguages,
  EthnologueLanguage
> {
  constructor(db: DrizzleService) {
    super(db, ethnologueLanguages, EthnologueLanguage);
  }

  async create(
    input: CreateEthnologueLanguage & { languageId: ID },
  ): Promise<UnsecuredDto<EthnologueLanguage>> {
    // The insert-Language-first ordering this used to wait for HAS LANDED on the
    // Drizzle path, so nothing here receives a placeholder id: `splitDb` routes
    // the ethnologue and Language repositories together, meaning whenever this
    // repo is live the Drizzle Language repo is its only caller and it passes the
    // real `languageId`.
    //
    // migration-todo: the surviving half is a Neo4j-only fallback.
    // `EthnologueLanguageService.create()` still passes `'temp' as ID` for the
    // Neo4j caller, because there the Language row is created *after* the
    // EthnologueLanguage and the relationship is wired up by the caller via the
    // returned ethnologue id — so Neo4j never reads `input.languageId`. (The Gel
    // repo's `create()` throws outright, since Gel creates the row as a
    // side-effect of the Language insert.) Retire the fallback with the Neo4j
    // repositories at Phase 7 cutover.
    //
    // For the record, since an earlier version of this comment said otherwise:
    // `language_id` carries a real, fully enforced FK to `languages(id)` from
    // migration 0016 — not `NOT VALID`, not deferrable, never dropped. A literal
    // `'temp'` would be REJECTED by that FK, not stored as bogus data.
    //
    // If the global-pool model arrives instead, the service `create()` becomes
    // "attach an existing pool entry by code, else insert a new one" — at which
    // point `languageId` here is the attaching Language and this repo's `create()`
    // only fires for genuinely new pool entries.
    //
    // If that is the path taken: codes are NOT unique (migration 0030 — sharing
    // is routine, not rare), so "the pool entry matching this code" is
    // frequently several rows. That step needs an explicit disambiguation rule
    // decided in application code; it cannot be a single-row lookup, and the
    // database will not narrow it for you.
    // Dormant until PG mode activates.
    const id = await generateId();
    await this.db.insert(ethnologueLanguages).values({
      id,
      languageId: input.languageId,
      code: input.code,
      provisionalCode: input.provisionalCode,
      name: input.name,
      population: input.population,
    });
    return await this.readOne(id);
  }

  async update(
    changes: UpdateEthnologueLanguage & { id: ID },
  ): Promise<UnsecuredDto<EthnologueLanguage>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      code: fields.code,
      provisionalCode: fields.provisionalCode,
      name: fields.name,
      population: fields.population,
    });
    return await this.readOne(id);
  }

  protected toDto(
    row: typeof ethnologueLanguages.$inferSelect,
  ): UnsecuredDto<EthnologueLanguage> {
    // `sensitivity` is intentionally omitted: the row doesn't carry it
    // (lives on the parent Language) and `EthnologueLanguageService.secure()`
    // overlays it via `withEffectiveSensitivity` before any consumer sees
    // the value. The `as unknown as` cast is the smallest temp patch possible —
    // populating a placeholder would read as a real default.
    //
    // migration-todo: (Phase 3&4) when Language migrates, JOIN
    // `languages.sensitivity` into readMany and remove this cast.
    return {
      id: row.id,
      __typename: 'EthnologueLanguage',
      code: row.code,
      provisionalCode: row.provisionalCode,
      name: row.name,
      population: row.population,
    } as unknown as UnsecuredDto<EthnologueLanguage>;
  }
}

/**
 * Build the column-level WHERE clauses for an `EthnologueLanguageFilters`
 * input against the `ethnologue_languages` table. Reusable from Language's
 * `ethnologue` sub-filter when that domain migrates.
 *
 * `code`/`provisionalCode`/`name` are partial substring matches to mirror
 * the Neo4j `filter.propPartialVal()` semantics in `language.repository.ts`.
 */
export const ethnologueLanguageFilterClauses = (
  _db: DrizzleDb,
  filter: EthnologueLanguageFilters | undefined,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.code) {
    conditions.push(
      ilike(ethnologueLanguages.code, `%${escapeLikePattern(filter.code)}%`),
    );
  }
  if (filter.provisionalCode) {
    conditions.push(
      ilike(
        ethnologueLanguages.provisionalCode,
        `%${escapeLikePattern(filter.provisionalCode)}%`,
      ),
    );
  }
  if (filter.name) {
    conditions.push(
      ilike(ethnologueLanguages.name, `%${escapeLikePattern(filter.name)}%`),
    );
  }
  return conditions;
};
