import { Injectable } from '@nestjs/common';
import { ilike, type SQL } from 'drizzle-orm';
import { generateId, type ID, type UnsecuredDto } from '~/common';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  escapeLikePattern,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { ethnologueLanguages } from '~/core/drizzle/schema';
import {
  type CreateEthnologueLanguage,
  EthnologueLanguage,
  type EthnologueLanguageFilters,
  type UpdateEthnologueLanguage,
} from '../dto';

const catchCodeUnique = catchUniqueViolation(
  'ethnologue_languages_code_unique',
  'code',
  'EthnologueLanguage with this code already exists.',
);
const catchProvisionalCodeUnique = catchUniqueViolation(
  'ethnologue_languages_provisional_code_unique',
  'provisionalCode',
  'EthnologueLanguage with this provisional code already exists.',
);

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
    // migration-todo: `EthnologueLanguageService.create()` currently passes
    // `'temp' as ID` for `languageId` because the Language row is created
    // *after* the EthnologueLanguage in `LanguageRepository.create()` — the
    // relationship is wired up by the caller via the returned ethnologue
    // id, so Neo4j never reads `input.languageId`. The Gel repo's `create()`
    // throws ("Database creates EthnologueLanguages directly. Don't call
    // this") because Gel creates the row as a side-effect of Language insert.
    //
    // Drizzle is the only impl that writes `input.languageId` to a real
    // column. With `language_id` now nullable (see schema comment), the
    // 'temp' string still slips through as a non-null bogus id today — the
    // schema doesn't reject it, but it's still wrong data.
    //
    // Resolution lands with the Language migration (Phase 3&4) by flipping
    // the create flow: insert Language first, then EthnologueLanguage with
    // the real `languageId`. Or, if the global-pool model is in place by
    // then, the service `create()` becomes "attach existing pool entry by
    // code if one matches, else insert a new pool entry" — at which point
    // `languageId` here is the attaching Language and the call to this
    // repo's `create()` only fires for genuinely new pool entries.
    // Dormant until PG mode activates.
    const id = await generateId();
    await this.db
      .insert(ethnologueLanguages)
      .values({
        id,
        languageId: input.languageId,
        code: input.code,
        provisionalCode: input.provisionalCode,
        name: input.name,
        population: input.population,
      })
      .catch(catchCodeUnique)
      .catch(catchProvisionalCodeUnique);
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
    })
      .catch(catchCodeUnique)
      .catch(catchProvisionalCodeUnique);
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
