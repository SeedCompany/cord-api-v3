import { Injectable } from '@nestjs/common';
import {
  and,
  eq,
  ilike,
  inArray,
  isNull,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  generateId,
  type ID,
  NotFoundException,
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
import {
  engagements,
  ethnologueLanguages,
  languages,
  projects,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { pinnedByRequester, pinnedFilter } from '../pin/pinned-by-requester';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import { recomputeProjectSensitivity } from '../project/project.drizzle.repository';
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

// No name / displayName equivalents: those columns are not unique (migration
// 0030 — distinct languages legitimately share a name), so there is no violation
// to map.
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
    }).catch(catchRolvUnique);

    if (fields.sensitivity !== undefined) {
      // Mirror of Gel's recalculateProjectSens trigger: keep engaging
      // translation projects' denormalized sensitivity current.
      const engaged = await this.db
        .select({ projectId: engagements.projectId })
        .from(engagements)
        .where(
          and(
            eq(engagements.languageId, id as ID<'Language'>),
            isNull(engagements.deletedAt),
          ),
        );
      await recomputeProjectSensitivity(
        this.db,
        engaged.map((e) => e.projectId),
      );
    }

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
    const derived = await this.engagementDerived(rows.map((r) => r.id));
    const pinnedSet = await pinnedByRequester(
      this.db,
      this.identity.current.userId,
      rows.map((r) => r.id),
    );
    return (rows as LanguageRow[]).map((row) =>
      this.toDto(
        { ...row, pinned: pinnedSet.has(row.id) },
        derived.get(row.id),
      ),
    );
  }

  /**
   * Engagement-derived read-time info per language: the projects engaging it
   * (effective sensitivity = lowest project sensitivity; requester scope is
   * the dedup'd union across them; presetInventory = any InDevelopment/Active
   * project flagged), whether any engagement uses AI-assisted translation,
   * and the firstScripture engagement. Mirror of the Neo4j hydrate.
   */
  private async engagementDerived(languageIds: ReadonlyArray<ID<'Language'>>) {
    const out = new Map<ID<'Language'>, EngagementDerived>();
    if (languageIds.length === 0) return out;
    const rows = await this.db
      .select({
        languageId: engagements.languageId,
        engagementId: engagements.id,
        firstScripture: engagements.firstScripture,
        usingAI: engagements.usingAIAssistedTranslation,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
        status: projects.status,
        presetInventory: projects.presetInventory,
      })
      .from(engagements)
      .innerJoin(projects, eq(engagements.projectId, projects.id))
      .where(
        and(
          inArray(engagements.languageId, [...languageIds]),
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
        ),
      );
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((r) => r.projectId),
    );
    const sensRank = { Low: 1, Medium: 2, High: 3 } as const;
    for (const row of rows) {
      const languageId = row.languageId!;
      const entry = out.get(languageId) ?? {
        effectiveSensitivity: undefined,
        presetInventory: false,
        usesAIAssistance: false,
        firstScriptureEngagement: null,
        scope: new Set<ScopedRole>(),
      };
      if (
        !entry.effectiveSensitivity ||
        sensRank[row.sensitivity] < sensRank[entry.effectiveSensitivity]
      ) {
        entry.effectiveSensitivity = row.sensitivity;
      }
      if (
        row.presetInventory &&
        (row.status === 'InDevelopment' || row.status === 'Active')
      ) {
        entry.presetInventory = true;
      }
      if (row.usingAI !== 'None' && row.usingAI !== 'Unknown') {
        entry.usesAIAssistance = true;
      }
      if (row.firstScripture && !entry.firstScriptureEngagement) {
        entry.firstScriptureEngagement = { id: row.engagementId };
      }
      for (const role of scopeByProject.get(row.projectId) ?? []) {
        entry.scope.add(role);
      }
      out.set(languageId, entry);
    }
    return out;
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

  async getEngagementIdsForLanguage(language: Language): Promise<ID[]> {
    const rows = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.languageId, language.id as ID<'Language'>),
          isNull(engagements.deletedAt),
        ),
      );
    return rows.map((r) => r.id);
  }

  async hasFirstScriptureEngagement(id: ID): Promise<boolean> {
    const [row] = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.languageId, id as ID<'Language'>),
          eq(engagements.firstScripture, true),
          isNull(engagements.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  async delete(id: ID): Promise<void> {
    // Capture engaging projects BEFORE the soft-delete: the denormalized
    // projects.sensitivity must be recomputed once this language stops
    // counting (Neo4j computes sensitivity live, so its delete needs no
    // equivalent). Same recipe as update()'s sensitivity-change path.
    const engaged = await this.db
      .select({ projectId: engagements.projectId })
      .from(engagements)
      .where(
        and(
          eq(engagements.languageId, id as ID<'Language'>),
          isNull(engagements.deletedAt),
        ),
      );
    await this.softDelete(id);
    await recomputeProjectSensitivity(
      this.db,
      engaged.map((row) => row.projectId),
    );
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
 * Column-level WHERE clauses for `LanguageFilters`.
 *
 * migration-todo: the usesAIAssistance list filter remains unimplemented —
 * its Neo4j side carries the known 42N07 shadowing fault on filter+sort
 * (won't fix, transition-only), so there is no working behavior to mirror;
 * decide its Postgres semantics when a consumer surfaces.
 */
export const languageFilterClauses = (
  db: DrizzleDb,
  filter: LanguageFilters | undefined,
  requesterId?: ID<'User'>,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.pinned != null) {
    conditions.push(pinnedFilter(requesterId, languages.id, filter.pinned));
  }
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
  // Derived, mirroring the Neo4j filter and the engagementDerived hydration:
  // a language is "preset inventory" when ANY project engaging it is flagged
  // AND currently InDevelopment/Active. This was silently ignored until
  // 2026-08-27 — the shadow-diff corpus caught the list answering unfiltered
  // (3,624 rows against Neo4j's 18).
  if (filter.presetInventory != null) {
    const anyFlaggedEngagingProject = sql`exists (
      select 1 from "engagements" "e"
      join "projects" "p" on "p"."id" = "e"."project_id"
      where "e"."language_id" = ${languages.id}
        and "e"."deleted_at" is null
        and "p"."deleted_at" is null
        and "p"."preset_inventory" = true
        and "p"."status" in ('InDevelopment', 'Active')
    )`;
    conditions.push(
      filter.presetInventory
        ? anyFlaggedEngagingProject
        : not(anyFlaggedEngagingProject),
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
    conditions.push(
      sql`exists (
        select 1 from "engagements" "e"
        join "partnerships" "ps" on "ps"."project_id" = "e"."project_id"
        where "e"."language_id" = ${languages.id}
          and "ps"."partner_id" = ${filter.partnerId}
          and "e"."deleted_at" is null
          and "ps"."deleted_at" is null
      )`,
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
