import { Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  generateId,
  type ID,
  NotFoundException,
  NotImplementedException,
  type ObjectView,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  escapeLikePattern,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import { ethnologueLanguages, languages } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import {
  type CreateLanguage,
  type EthnologueLanguage,
  Language,
  type LanguageFilters,
  type LanguageListInput,
  type UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';
import { ethnologueLanguageFilterClauses } from './ethnologue-language/ethnologue-language.drizzle.repository';

type LanguageRow = typeof languages.$inferSelect & {
  ethnologue?: typeof ethnologueLanguages.$inferSelect | null;
  pinned?: boolean;
};

const catchNameUnique = catchUniqueViolation(
  'languages_name_active_unique',
  'name',
  'name with this value already exists',
);
const catchDisplayNameUnique = catchUniqueViolation(
  'languages_display_name_active_unique',
  'displayName',
  'displayName with this value already exists',
);
const catchRolvUnique = catchUniqueViolation(
  'languages_rolv_code_active_unique',
  'registryOfLanguageVarietiesCode',
  'registryOfLanguageVarietiesCode with this value already exists',
);

@Injectable()
export class LanguageDrizzleRepository extends DrizzleDtoRepository<
  typeof languages,
  Language
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    private readonly ethnologueLanguageService: EthnologueLanguageService,
  ) {
    super(db, languages, Language);
  }

  async create(input: CreateLanguage): Promise<UnsecuredDto<Language>> {
    const id = await generateId<ID<'Language'>>();
    await this.db
      .insert(languages)
      .values({
        id,
        name: input.name,
        displayName: input.displayName,
        displayNamePronunciation: input.displayNamePronunciation ?? null,
        sensitivity: input.sensitivity ?? 'High',
        isDialect: input.isDialect ?? false,
        populationOverride: input.populationOverride ?? null,
        registryOfLanguageVarietiesCode:
          (input.registryOfLanguageVarietiesCode !== undefined
            ? input.registryOfLanguageVarietiesCode
            : input.registryOfDialectsCode) ?? null,
        leastOfThese: input.leastOfThese ?? false,
        leastOfTheseReason: input.leastOfTheseReason ?? null,
        isSignLanguage: input.isSignLanguage ?? false,
        signLanguageCode: input.signLanguageCode ?? null,
        sponsorEstimatedEndDate:
          input.sponsorEstimatedEndDate?.toSQLDate() ?? null,
        hasExternalFirstScripture: input.hasExternalFirstScripture ?? false,
        tags: input.tags ? [...input.tags] : [],
        isAvailableForReporting: input.isAvailableForReporting ?? false,
      })
      .catch(catchNameUnique)
      .catch(catchDisplayNameUnique)
      .catch(catchRolvUnique);

    // Mirror of Gel's connectEthnologue trigger: the Language row exists
    // first, then the EthnologueLanguage attaches to it (resolves the
    // 'temp' languageId hack documented in the ethnologue drizzle repo).
    await this.ethnologueLanguageService.create(input.ethnologue ?? {}, id);

    return await this.readOne(id);
  }

  async update(
    changes: Omit<UpdateLanguage, 'ethnologue'>,
    _changeset?: ID,
  ): Promise<UnsecuredDto<Language>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      displayName: fields.displayName,
      displayNamePronunciation: fields.displayNamePronunciation,
      sensitivity: fields.sensitivity,
      isDialect: fields.isDialect,
      populationOverride: fields.populationOverride,
      registryOfLanguageVarietiesCode: fields.registryOfLanguageVarietiesCode,
      leastOfThese: fields.leastOfThese,
      leastOfTheseReason: fields.leastOfTheseReason,
      isSignLanguage: fields.isSignLanguage,
      signLanguageCode: fields.signLanguageCode,
      ...(fields.sponsorEstimatedEndDate !== undefined && {
        sponsorEstimatedEndDate:
          fields.sponsorEstimatedEndDate?.toSQLDate() ?? null,
      }),
      hasExternalFirstScripture: fields.hasExternalFirstScripture,
      ...(fields.tags !== undefined && { tags: [...fields.tags] }),
      isAvailableForReporting: fields.isAvailableForReporting,
    })
      .catch(catchNameUnique)
      .catch(catchDisplayNameUnique)
      .catch(catchRolvUnique);

    // migration-todo (Engagement recut): restore the project-sensitivity
    // recompute over engaging projects (mono queries `engagements` +
    // recomputeProjectSensitivity). No engagements can exist until that
    // table lands, so there is nothing to recompute here yet.

    return await this.readOne(id);
  }

  override async readMany(
    ids: readonly ID[],
    _view?: ObjectView,
  ): Promise<Array<UnsecuredDto<Language>>> {
    if (ids.length === 0) return [];
    // Mirror the Neo4j readMany's `filterManyToReadable`: without this,
    // member/sensitivity-gated roles could resolve unreadable languages by
    // id (readOne delegates here too). The condition SQL references literal
    // table names, so it runs over a plain id-select rather than inside the
    // relational query; survivors hydrate through the normal path.
    const readConditions: SQL[] = [
      inArray(languages.id, [...ids]),
      isNull(languages.deletedAt),
    ];
    if (!this.executor.applyReadFilter(this.resource, readConditions)) {
      return [];
    }
    const readable = await this.db
      .select({ id: languages.id })
      .from(languages)
      .where(and(...readConditions));
    if (readable.length === 0) return [];
    const readableIds = readable.map((row) => row.id);
    const rows = await this.db.query.languages.findMany({
      where: (l) => inArray(l.id, readableIds),
      with: { ethnologue: true },
    });
    // migration-todo (Engagement recut): restore the engagementDerived()
    // batch — effectiveSensitivity/presetInventory/usesAIAssistance/
    // firstScriptureEngagement/scope all derive from engaging projects, so
    // toDto's fallbacks (own sensitivity, false, null, []) are exact while
    // no engagements can exist.
    // migration-todo (Pin recut): restore the pinnedByRequester batch;
    // pinned hardcodes false until then.
    return (rows as LanguageRow[]).map((row) =>
      this.toDto({ ...row, pinned: false }),
    );
  }

  async readOneByEth(ethnologueId: ID): Promise<UnsecuredDto<Language>> {
    const eth = await this.db.query.ethnologueLanguages.findFirst({
      where: (e) => eq(e.id, ethnologueId as ID<'EthnologueLanguage'>),
      columns: { languageId: true },
    });
    if (!eth?.languageId) {
      throw new NotFoundException('No Language exists for this Ethnologue id');
    }
    return await this.readOne(eth.languageId);
  }

  async list(
    input: LanguageListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Language>>> {
    const conditions: SQL[] = [isNull(languages.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(
      ...languageFilterClauses(
        this.db,
        input.filter,
        this.identity.current.userId,
      ),
    );

    const sortColumns = {
      name: languages.name,
      displayName: languages.displayName,
      sensitivity: languages.sensitivity,
      isDialect: languages.isDialect,
      leastOfThese: languages.leastOfThese,
      isSignLanguage: languages.isSignLanguage,
      isAvailableForReporting: languages.isAvailableForReporting,
      registryOfLanguageVarietiesCode:
        languages.registryOfLanguageVarietiesCode,
      createdAt: languages.createdAt,
      // migration-todo (Engagement step): population (override ?? ethnologue),
      // ethnologue.* delegation, and usesAIAssistance sorts. Unknown sort keys
      // fall back to name via resolveOrderBy.
    } satisfies SortMap<keyof Language>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, languages.name),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };

    // Two-phase: paged IDs → readMany picks up the ethnologue relation.
    const items = await this.readMany(rows.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      items: rows.map((r) => byId.get(r.id)!).filter(Boolean),
      hasMore,
    };
  }

  // migration-todo (Engagement recut): query `engagements` for real. Until
  // that table lands no engagements can exist, so an empty list is exact —
  // and it keeps the service's delete guard permissive, correctly.
  async getEngagementIdsForLanguage(_language: Language): Promise<ID[]> {
    return [];
  }

  // migration-todo (Engagement recut): query `engagements.first_scripture`
  // for real. Exact while no engagements can exist.
  async hasFirstScriptureEngagement(_id: ID): Promise<boolean> {
    return false;
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  protected toDto(
    row: LanguageRow,
    derived?: EngagementDerived,
  ): UnsecuredDto<Language> {
    if (!row.ethnologue) {
      throw new Error(
        `Language ${row.id} has no attached EthnologueLanguage — create-flow invariant violated`,
      );
    }
    const ethnologue = {
      id: row.ethnologue.id,
      __typename: 'EthnologueLanguage',
      code: row.ethnologue.code,
      provisionalCode: row.ethnologue.provisionalCode,
      name: row.ethnologue.name,
      population: row.ethnologue.population,
    } as unknown as UnsecuredDto<EthnologueLanguage>;

    const dto: unknown = {
      id: row.id,
      __typename: 'Language',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      displayName: row.displayName,
      displayNamePronunciation: row.displayNamePronunciation,
      sensitivity: row.sensitivity,
      // Lowest sensitivity across projects engaging this language; falls back
      // to own sensitivity when unengaged (mirror of Neo4j rankSens ASC pick).
      effectiveSensitivity: derived?.effectiveSensitivity ?? row.sensitivity,
      isDialect: row.isDialect,
      populationOverride: row.populationOverride,
      population: row.populationOverride ?? row.ethnologue.population,
      registryOfLanguageVarietiesCode: row.registryOfLanguageVarietiesCode,
      leastOfThese: row.leastOfThese,
      leastOfTheseReason: row.leastOfTheseReason,
      isSignLanguage: row.isSignLanguage,
      signLanguageCode: row.signLanguageCode,
      sponsorEstimatedEndDate: row.sponsorEstimatedEndDate
        ? CalendarDate.fromISO(row.sponsorEstimatedEndDate)
        : null,
      hasExternalFirstScripture: row.hasExternalFirstScripture,
      firstScriptureEngagement: derived?.firstScriptureEngagement ?? null,
      tags: [...row.tags],
      isAvailableForReporting: row.isAvailableForReporting,
      presetInventory: derived?.presetInventory ?? false,
      usesAIAssistance: derived?.usesAIAssistance ?? false,
      pinned: row.pinned ?? false,
      ethnologue,
      // Scoped roles aggregated (dedup'd) across all projects engaging this
      // language — mirror of the Neo4j hydrate's collected scopedRoles.
      scope: derived ? [...derived.scope] : [],
      changeset: undefined,
      canDelete: true,
    };
    return dto as UnsecuredDto<Language>;
  }
}

interface EngagementDerived {
  effectiveSensitivity:
    | (typeof languages.$inferSelect)['sensitivity']
    | undefined;
  presetInventory: boolean;
  usesAIAssistance: boolean;
  firstScriptureEngagement: { id: ID } | null;
  scope: Set<ScopedRole>;
}

/**
 * Column-level WHERE clauses for `LanguageFilters`. presetInventory /
 * usesAIAssistance list filters remain unimplemented (rarely used;
 * migration-todo if a consumer surfaces).
 */
export const languageFilterClauses = (
  db: DrizzleDb,
  filter: LanguageFilters | undefined,
  _requesterId?: ID<'User'>,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  // migration-todo (Pin recut): restore the pinnedFilter branch; until the
  // pins table lands the filter is ignored (matches the Project/Partner
  // recut posture — the pinned e2e stays red at the Pin boundary).

  if (filter.name) {
    const pattern = `%${escapeLikePattern(filter.name)}%`;
    conditions.push(
      or(
        ilike(languages.name, pattern),
        ilike(languages.displayName, pattern),
      )!,
    );
  }
  if (filter.sensitivity?.length) {
    conditions.push(inArray(languages.sensitivity, [...filter.sensitivity]));
  }
  if (filter.leastOfThese != null) {
    conditions.push(eq(languages.leastOfThese, filter.leastOfThese));
  }
  if (filter.isSignLanguage != null) {
    conditions.push(eq(languages.isSignLanguage, filter.isSignLanguage));
  }
  if (filter.isDialect != null) {
    conditions.push(eq(languages.isDialect, filter.isDialect));
  }
  if (filter.isAvailableForReporting != null) {
    conditions.push(
      eq(languages.isAvailableForReporting, filter.isAvailableForReporting),
    );
  }
  const rolv =
    filter.registryOfLanguageVarietiesCode ?? filter.registryOfDialectsCode;
  if (rolv) {
    conditions.push(
      ilike(
        languages.registryOfLanguageVarietiesCode,
        `%${escapeLikePattern(rolv)}%`,
      ),
    );
  }
  if (filter.signLanguageCode) {
    conditions.push(
      ilike(
        languages.signLanguageCode,
        `%${escapeLikePattern(filter.signLanguageCode)}%`,
      ),
    );
  }
  if (filter.partnerId) {
    // migration-todo (Engagement recut): restore the engagements→partnerships
    // EXISTS. Raw SQL would compile but crash at runtime against the missing
    // table — fail loud instead.
    throw new NotImplementedException(
      'LanguageFilters.partnerId requires the Engagement migration',
    );
  }
  if (filter.ethnologue) {
    const ethConditions = ethnologueLanguageFilterClauses(
      db,
      filter.ethnologue,
    );
    if (ethConditions.length > 0) {
      conditions.push(
        inArray(
          languages.id,
          db
            .select({ id: ethnologueLanguages.languageId })
            .from(ethnologueLanguages)
            .where(and(...ethConditions)),
        ),
      );
    }
  }
  return conditions;
};
