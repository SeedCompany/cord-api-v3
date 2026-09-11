import { Injectable } from '@nestjs/common';
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { type AnyPgColumn, type PgTable } from 'drizzle-orm/pg-core';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  type DateFilter,
  DuplicateException,
  EnhancedResource,
  generateId,
  type ID,
  InputException,
  NotFoundException,
  NotImplementedException,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { getChanges } from '~/core/database/changes';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  escapeLikePattern,
  orderEntries,
  type SortColumns,
  type SortEntry,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  engagementStatusHistory,
  languages,
  periodicReports,
  projects,
  tools,
  toolUsages,
  users,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import {
  languageFilterClauses,
  languageSortEntry,
} from '../language/language.drizzle.repository';
import { periodicReportSortColumns } from '../periodic-report/periodic-report.sorts';
import { IProject } from '../project/dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  projectFilterClauses,
  projectSortEntry,
  recomputeProjectSensitivity,
} from '../project/project.drizzle.repository';
import { toolFilterClauses } from '../tools/tool/tool.drizzle.repository';
import { userFilterClauses } from '../user/user.drizzle.repository';
import {
  type CreateInternshipEngagement,
  type CreateLanguageEngagement,
  type Engagement,
  type EngagementListInput,
  EngagementStatus,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  type UpdateInternshipEngagement,
  type UpdateLanguageEngagement,
} from './dto';

// Backstops for the partial unique indexes when a concurrent create slips
// past verifyRelationshipEligibility's pre-flight — same field + message so
// both paths surface the identical DuplicateException.
const catchDuplicateLanguageEngagement = catchUniqueViolation(
  'engagements_project_language_active_unique',
  'language',
  'Engagement for this project and language already exists',
);
const catchDuplicateInternEngagement = catchUniqueViolation(
  'engagements_project_intern_active_unique',
  'intern',
  'Engagement for this project and person already exists',
);

type EngagementRow = typeof engagements.$inferSelect & {
  project?: Pick<
    typeof projects.$inferSelect,
    | 'id'
    | 'type'
    | 'status'
    | 'step'
    | 'name'
    | 'sensitivity'
    | 'mouStart'
    | 'mouEnd'
  > | null;
  language?: Pick<typeof languages.$inferSelect, 'id' | 'name'> | null;
  intern?: Pick<
    typeof users.$inferSelect,
    'id' | 'displayFirstName' | 'displayLastName'
  > | null;
  mentor?: { id: ID<'User'> } | null;
  countryOfOrigin?: { id: ID<'Location'> } | null;
  ceremony?: { id: ID<'Ceremony'> } | null;
};

const RELATIONS = {
  project: {
    columns: {
      id: true,
      type: true,
      status: true,
      step: true,
      name: true,
      sensitivity: true,
      mouStart: true,
      mouEnd: true,
    },
  },
  language: { columns: { id: true, name: true } },
  intern: {
    columns: { id: true, displayFirstName: true, displayLastName: true },
  },
  mentor: { columns: { id: true } },
  countryOfOrigin: { columns: { id: true } },
  ceremony: { columns: { id: true } },
} as const;

@Injectable()
export class EngagementDrizzleRepository extends DrizzleDtoRepository<
  typeof engagements,
  Engagement & { id: ID }
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    private readonly files: FileService,
  ) {
    // migration-todo: as-any bridges the IEngagement interface class into the
    // concrete-resource slot DrizzleDtoRepository expects (same bridge as
    // project.module's splitDb cast) — dies with the base-class rework at cutover.
    super(db, engagements, IEngagement as any);
  }

  getActualLanguageChanges = getChanges(LanguageEngagement);
  getActualInternshipChanges = getChanges(InternshipEngagement);

  override async readOne(
    id: ID,
    _view?: ObjectView,
  ): Promise<UnsecuredDto<Engagement>> {
    const [dto] = await this.readMany([id]);
    if (!dto) {
      throw new NotFoundException('Could not find Engagement');
    }
    return dto;
  }

  override async readMany(
    ids: readonly ID[],
    _view?: ObjectView,
  ): Promise<Array<UnsecuredDto<Engagement>>> {
    // View accepted for splitDb signature parity; PCR/Changeset is excluded.
    if (ids.length === 0) return [];
    // Mirror the Neo4j readMany, which gates by-id reads on the PARENT
    // PROJECT's readability (privileges.for(IProject).filterToReadable) —
    // while list() gates by IEngagement, matching the same asymmetry in the
    // Neo4j repo. The Project condition SQL references the literal
    // "projects" table, so it runs inside an EXISTS over the unaliased
    // table correlated on project_id; survivors hydrate normally.
    const projectConditions: SQL[] = [isNull(projects.deletedAt)];
    if (
      !this.executor.applyReadFilter(
        EnhancedResource.of(IProject),
        projectConditions,
      )
    ) {
      return [];
    }
    const readable = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          inArray(engagements.id, [...ids]),
          isNull(engagements.deletedAt),
          sql`exists (select 1 from "projects" where "projects"."id" = ${
            engagements.projectId
          } and ${and(...projectConditions)})`,
        ),
      );
    if (readable.length === 0) return [];
    const readableIds = readable.map((row) => row.id);
    const rows = await this.db.query.engagements.findMany({
      where: (e) => inArray(e.id, readableIds),
      with: RELATIONS,
    });
    return await this.mapRows(rows as EngagementRow[]);
  }

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    _changeset?: ID,
  ): Promise<UnsecuredDto<LanguageEngagement>> {
    await this.verifyRelationshipEligibility(
      input.project,
      input.language,
      false,
    );
    if (input.firstScripture) {
      await this.verifyFirstScripture({ languageId: input.language });
    }

    const id = await generateId<ID<'Engagement'>>();
    const pnpId = await generateId();
    await this.db
      .insert(engagements)
      .values({
        id,
        projectId: input.project,
        type: 'Language',
        status: input.status ?? 'InDevelopment',
        languageId: input.language,
        firstScripture: input.firstScripture ?? null,
        lukePartnership: input.lukePartnership ?? null,
        openToInvestorVisit: input.openToInvestorVisit ?? null,
        paratextRegistryId: input.paratextRegistryId ?? null,
        rev79CommunityId: input.rev79CommunityId ?? null,
        completeDate: input.completeDate?.toSQLDate() ?? null,
        disbursementCompleteDate:
          input.disbursementCompleteDate?.toSQLDate() ?? null,
        startDateOverride: input.startDateOverride?.toSQLDate() ?? null,
        endDateOverride: input.endDateOverride?.toSQLDate() ?? null,
        historicGoal: input.historicGoal ?? null,
        milestonePlanned: input.milestonePlanned ?? 'Unknown',
        usingAIAssistedTranslation:
          input.usingAIAssistedTranslation ?? 'Unknown',
        pnpId,
      })
      .catch(catchDuplicateLanguageEngagement);

    await this.files.createDefinedFile(pnpId, `PNP`, id, 'pnp', input.pnp);

    await recomputeProjectSensitivity(this.db, [input.project]);

    return (await this.readOne(id)) as UnsecuredDto<LanguageEngagement>;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    _changeset?: ID,
  ): Promise<UnsecuredDto<InternshipEngagement>> {
    await this.verifyRelationshipEligibility(input.project, input.intern, true);

    if (input.mentor && !(await this.userExists(input.mentor))) {
      throw new NotFoundException('Could not find mentor', 'mentor');
    }
    if (
      input.countryOfOrigin &&
      !(await this.locationExists(input.countryOfOrigin))
    ) {
      throw new NotFoundException(
        'Could not find country of origin',
        'countryOfOrigin',
      );
    }

    const id = await generateId<ID<'Engagement'>>();
    const growthPlanId = await generateId();
    await this.db
      .insert(engagements)
      .values({
        id,
        projectId: input.project,
        type: 'Internship',
        status: input.status ?? 'InDevelopment',
        internId: input.intern,
        mentorId: input.mentor ?? null,
        position: input.position ?? null,
        methodologies: input.methodologies ? [...input.methodologies] : [],
        countryOfOriginId: input.countryOfOrigin ?? null,
        marketable: input.marketable ?? false,
        webId: input.webId ?? null,
        completeDate: input.completeDate?.toSQLDate() ?? null,
        disbursementCompleteDate:
          input.disbursementCompleteDate?.toSQLDate() ?? null,
        startDateOverride: input.startDateOverride?.toSQLDate() ?? null,
        endDateOverride: input.endDateOverride?.toSQLDate() ?? null,
        growthPlanId,
      })
      .catch(catchDuplicateInternEngagement);

    await this.files.createDefinedFile(
      growthPlanId,
      `Growth Plan`,
      id,
      'growthPlan',
      input.growthPlan,
    );

    return (await this.readOne(id)) as UnsecuredDto<InternshipEngagement>;
  }

  async updateLanguage(
    changes: UpdateLanguageEngagement,
    _changeset?: ID,
  ): Promise<UnsecuredDto<LanguageEngagement>> {
    const { id, pnp, status, ...simple } = changes;

    if (pnp) {
      const engagement = (await this.readOne(
        id,
      )) as UnsecuredDto<LanguageEngagement>;
      if (!engagement.pnp) {
        throw new ServerException(
          'Expected PnP file to be created with the engagement',
        );
      }
      await this.files.createFileVersion({ ...pnp, parent: engagement.pnp.id });
    }
    if (changes.firstScripture) {
      await this.verifyFirstScripture({ engagementId: id });
    }

    // migration-todo: the `(simple as any)` reads bridge fields the service's
    // getActualChanges diff carries beyond the Update DTO's declared type
    // (rev79CommunityId / initialEndDate / milestoneReached / modifiedAt) —
    // type the changes shape properly when the Neo4j repo retires.
    await this.updateColumns(id, {
      firstScripture: simple.firstScripture,
      lukePartnership: simple.lukePartnership,
      openToInvestorVisit: simple.openToInvestorVisit,
      paratextRegistryId: simple.paratextRegistryId,
      rev79CommunityId: (simple as any).rev79CommunityId,
      ...(simple.completeDate !== undefined && {
        completeDate: simple.completeDate?.toSQLDate() ?? null,
      }),
      ...(simple.disbursementCompleteDate !== undefined && {
        disbursementCompleteDate:
          simple.disbursementCompleteDate?.toSQLDate() ?? null,
      }),
      ...(simple.startDateOverride !== undefined && {
        startDateOverride: simple.startDateOverride?.toSQLDate() ?? null,
      }),
      ...(simple.endDateOverride !== undefined && {
        endDateOverride: simple.endDateOverride?.toSQLDate() ?? null,
      }),
      ...((simple as any).initialEndDate !== undefined && {
        initialEndDate:
          (
            (simple as any).initialEndDate as CalendarDate | null
          )?.toSQLDate() ?? null,
      }),
      description: simple.description as any,
      historicGoal: simple.historicGoal,
      milestonePlanned: simple.milestonePlanned,
      milestoneReached: (simple as any).milestoneReached,
      usingAIAssistedTranslation: simple.usingAIAssistedTranslation,
      sentPrintingDate: undefined,
      ...((simple as any).modifiedAt !== undefined && {
        modifiedAt: ((simple as any).modifiedAt as DateTime).toJSDate(),
      }),
    });

    if (status) {
      await this.applyStatusChange(
        id,
        status,
        ((simple as any).modifiedAt as DateTime | undefined)?.toJSDate(),
      );
    }

    return (await this.readOne(id)) as UnsecuredDto<LanguageEngagement>;
  }

  async updateInternship(
    changes: UpdateInternshipEngagement,
    _changeset?: ID,
  ): Promise<UnsecuredDto<InternshipEngagement>> {
    const { id, mentor, countryOfOrigin, growthPlan, status, ...simple } =
      changes;

    if (growthPlan) {
      const engagement = (await this.readOne(
        id,
      )) as UnsecuredDto<InternshipEngagement>;
      if (!engagement.growthPlan) {
        throw new ServerException(
          'Expected Growth Plan file to be created with the engagement',
        );
      }
      await this.files.createFileVersion({
        ...growthPlan,
        parent: engagement.growthPlan.id,
      });
    }

    // migration-todo: same `(simple as any)` bridge as updateLanguage above.
    await this.updateColumns(id, {
      ...(mentor !== undefined && { mentorId: mentor }),
      ...(countryOfOrigin !== undefined && {
        countryOfOriginId: countryOfOrigin,
      }),
      position: simple.position,
      marketable: simple.marketable,
      webId: simple.webId,
      ...(simple.methodologies !== undefined && {
        methodologies: [...simple.methodologies],
      }),
      ...(simple.completeDate !== undefined && {
        completeDate: simple.completeDate?.toSQLDate() ?? null,
      }),
      ...(simple.disbursementCompleteDate !== undefined && {
        disbursementCompleteDate:
          simple.disbursementCompleteDate?.toSQLDate() ?? null,
      }),
      ...(simple.startDateOverride !== undefined && {
        startDateOverride: simple.startDateOverride?.toSQLDate() ?? null,
      }),
      ...(simple.endDateOverride !== undefined && {
        endDateOverride: simple.endDateOverride?.toSQLDate() ?? null,
      }),
      ...((simple as any).initialEndDate !== undefined && {
        initialEndDate:
          (
            (simple as any).initialEndDate as CalendarDate | null
          )?.toSQLDate() ?? null,
      }),
      description: simple.description as any,
      ...((simple as any).modifiedAt !== undefined && {
        modifiedAt: ((simple as any).modifiedAt as DateTime).toJSDate(),
      }),
    });

    if (status) {
      await this.applyStatusChange(
        id,
        status,
        ((simple as any).modifiedAt as DateTime | undefined)?.toJSDate(),
      );
    }

    return (await this.readOne(id)) as UnsecuredDto<InternshipEngagement>;
  }

  /**
   * Status change side-effects, mirror of the Gel rewrites: stamp
   * statusModifiedAt, track suspension/reactivation timestamps, and append
   * the previous status to history (drives the rules engine's "BackTo"
   * transitions).
   */
  private async applyStatusChange(id: ID, next: EngagementStatus, at?: Date) {
    // Row lock so concurrent status changes serialize: each transition reads
    // the true previous status before writing its history row (the mutation
    // interceptor already has us inside a transaction).
    const [current] = await this.db
      .select({ status: engagements.status })
      .from(engagements)
      .where(eq(engagements.id, id as ID<'Engagement'>))
      .for('update');
    const prev = current?.status;
    if (!prev || prev === next) return;

    // Stamp with the update's modifiedAt when available so
    // statusModifiedAt === modifiedAt (mirror of the Neo4j SetLastStatusDate
    // handler, which copied updated.modifiedAt).
    const now = at ?? new Date();
    await this.db
      .update(engagements)
      .set({
        status: next,
        statusModifiedAt: now,
        ...(next === 'Suspended' && { lastSuspendedAt: now }),
        // Only a true reactivation (Suspended → Active) — Suspended →
        // Terminated etc. must NOT stamp it (mirrors SetLastStatusDate).
        ...(prev === 'Suspended' &&
          next === 'Active' && { lastReactivatedAt: now }),
      })
      .where(eq(engagements.id, id as ID<'Engagement'>));
    await this.db.insert(engagementStatusHistory).values({
      engagementId: id as ID<'Engagement'>,
      status: prev,
    });
  }

  async list(input: EngagementListInput, _changeset?: ID) {
    const conditions: SQL[] = [isNull(engagements.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    conditions.push(
      ...engagementFilterClauses(
        this.db,
        input.filter,
        this.identity.current.userId,
      ),
    );

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: orderEntries(
        engagementSortEntry(input.sort as string) ?? engagements.createdAt,
        input.order,
      ),
      page: input.page,
      count: input.count,
    });
    if (rows.length === 0) return { total, items: [], hasMore };

    const items = await this.readMany(rows.map((r) => r.id));
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      total,
      items: rows.map((r) => byId.get(r.id)!).filter(Boolean),
      hasMore,
    };
  }

  /** Assumed internal and unsecured. */
  async listAllByProjectId(
    projectId: ID,
  ): Promise<Array<UnsecuredDto<Engagement>>> {
    const rows = await this.db.query.engagements.findMany({
      where: (e) =>
        and(eq(e.projectId, projectId as ID<'Project'>), isNull(e.deletedAt)),
      with: RELATIONS,
    });
    return await this.mapRows(rows as EngagementRow[]);
  }

  async getOngoingEngagementIds(
    projectId: ID,
    excludes: EngagementStatus[] = [],
  ): Promise<readonly ID[]> {
    const statuses = difference([...EngagementStatus.Ongoing], excludes);
    if (statuses.length === 0) return [];
    const rows = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.projectId, projectId as ID<'Project'>),
          inArray(engagements.status, statuses),
          isNull(engagements.deletedAt),
        ),
      );
    return rows.map((r) => r.id);
  }

  protected async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    isInternship: boolean,
    _changeset?: ID,
  ) {
    const property = isInternship ? 'intern' : 'language';
    const label = isInternship ? 'person' : 'language';

    const [project] = await this.db
      .select({ id: projects.id, type: projects.type })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId as ID<'Project'>),
          isNull(projects.deletedAt),
        ),
      );
    if (!project) {
      throw new NotFoundException('Could not find project', 'project');
    }

    const isActuallyInternship = project.type === 'Internship';
    if (isActuallyInternship !== isInternship) {
      throw new InputException(
        `Only ${
          isInternship ? 'Internship' : 'Language'
        } Engagements can be created on ${
          isInternship ? 'Internship' : 'Translation'
        } Projects`,
        property,
      );
    }

    const other = isInternship
      ? await this.userExists(otherId)
      : await this.languageExists(otherId);
    if (!other) {
      throw new NotFoundException(`Could not find ${label}`, property);
    }

    const otherColumn = isInternship
      ? engagements.internId
      : engagements.languageId;
    const [duplicate] = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.projectId, projectId as ID<'Project'>),
          eq(otherColumn, otherId),
          isNull(engagements.deletedAt),
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new DuplicateException(
        property,
        `Engagement for this project and ${label} already exists`,
      );
    }
  }

  private async userExists(id: ID) {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id as ID<'User'>), isNull(users.deletedAt)))
      .limit(1);
    return !!row;
  }

  private async languageExists(id: ID) {
    const [row] = await this.db
      .select({ id: languages.id })
      .from(languages)
      .where(
        and(
          eq(languages.id, id as ID<'Language'>),
          isNull(languages.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  private async locationExists(id: ID) {
    const [row] = await this.db.query.locations
      .findFirst({
        where: (l, { eq: eq2, and: and2, isNull: isNull2 }) =>
          and2(eq2(l.id, id as ID<'Location'>), isNull2(l.deletedAt)),
        columns: { id: true },
      })
      .then((r) => [r]);
    return !!row;
  }

  private async doesLanguageHaveExternalFirstScripture(languageId: ID) {
    const [row] = await this.db
      .select({ id: languages.id })
      .from(languages)
      .where(
        and(
          eq(languages.id, languageId as ID<'Language'>),
          eq(languages.hasExternalFirstScripture, true),
          isNull(languages.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  private async doOtherEngagementsHaveFirstScripture(languageId: ID) {
    const [row] = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.languageId, languageId as ID<'Language'>),
          eq(engagements.firstScripture, true),
          isNull(engagements.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  private async resolveLanguageId({
    engagementId,
    languageId,
  }: {
    engagementId?: ID;
    languageId?: ID;
  }): Promise<ID> {
    if (languageId) return languageId;
    const [row] = await this.db
      .select({ languageId: engagements.languageId })
      .from(engagements)
      .where(eq(engagements.id, engagementId! as ID<'Engagement'>));
    if (!row?.languageId) {
      throw new NotFoundException('Could not find engagement language');
    }
    return row.languageId;
  }

  private async verifyFirstScripture(id: {
    engagementId?: ID;
    languageId?: ID;
  }) {
    const languageId = await this.resolveLanguageId(id);
    if (await this.doesLanguageHaveExternalFirstScripture(languageId)) {
      throw new InputException(
        'First scripture has already been marked as having been done externally',
        'firstScripture',
      );
    }
    if (await this.doOtherEngagementsHaveFirstScripture(languageId)) {
      throw new InputException(
        'Another engagement has already been marked as having done the first scripture',
        'firstScripture',
      );
    }
  }

  async delete(id: ID, _changeset?: ID): Promise<void> {
    const [row] = await this.db
      .select({ projectId: engagements.projectId, type: engagements.type })
      .from(engagements)
      .where(eq(engagements.id, id as ID<'Engagement'>));
    await this.softDelete(id);
    if (row?.type === 'Language') {
      await recomputeProjectSensitivity(this.db, [row.projectId]);
    }
  }

  private async mapRows(rows: EngagementRow[]) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => r.project?.id ?? []),
    );
    return rows.map((row) =>
      this.toDto(
        row,
        row.project ? (scopeByProject.get(row.project.id) ?? []) : [],
      ),
    );
  }

  protected toDto(
    row: EngagementRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<Engagement> {
    if (!row.project) {
      throw new Error(
        `Engagement ${row.id} has no parent project row — FK invariant violated`,
      );
    }
    const isLanguage = row.type === 'Language';
    const startDate = row.startDateOverride ?? row.project.mouStart ?? null;
    const endDate = row.endDateOverride ?? row.project.mouEnd ?? null;
    const dto: unknown = {
      id: row.id,
      // The `default::` prefix matches the Neo4j/Gel hydrates —
      // resolveEngagementType keys off the prefixed form.
      __typename: isLanguage
        ? 'default::LanguageEngagement'
        : 'default::InternshipEngagement',
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.modifiedAt),
      parent: {
        id: row.project.id,
        __typename: `${row.project.type}Project`,
      },
      project: {
        id: row.project.id,
        type: row.project.type,
        status: row.project.status,
        step: row.project.step,
      },
      label: {
        project: row.project.name,
        language: row.language?.name ?? null,
        intern: row.intern
          ? [row.intern.displayFirstName, row.intern.displayLastName]
              .filter(Boolean)
              .join(' ') || null
          : null,
      },
      status: row.status,
      statusModifiedAt: row.statusModifiedAt
        ? DateTime.fromJSDate(row.statusModifiedAt)
        : null,
      lastSuspendedAt: row.lastSuspendedAt
        ? DateTime.fromJSDate(row.lastSuspendedAt)
        : null,
      lastReactivatedAt: row.lastReactivatedAt
        ? DateTime.fromJSDate(row.lastReactivatedAt)
        : null,
      completeDate: row.completeDate
        ? CalendarDate.fromISO(row.completeDate)
        : null,
      disbursementCompleteDate: row.disbursementCompleteDate
        ? CalendarDate.fromISO(row.disbursementCompleteDate)
        : null,
      startDateOverride: row.startDateOverride
        ? CalendarDate.fromISO(row.startDateOverride)
        : null,
      endDateOverride: row.endDateOverride
        ? CalendarDate.fromISO(row.endDateOverride)
        : null,
      startDate: startDate ? CalendarDate.fromISO(startDate) : null,
      endDate: endDate ? CalendarDate.fromISO(endDate) : null,
      initialEndDate: row.initialEndDate
        ? CalendarDate.fromISO(row.initialEndDate)
        : null,
      description: row.description ?? null,
      sensitivity: row.project.sensitivity,
      ceremony: row.ceremony ? { id: row.ceremony.id } : null,
      changeset: undefined,
      canDelete: true,
      scope,
      ...(isLanguage
        ? {
            language: { id: row.languageId },
            firstScripture: row.firstScripture,
            lukePartnership: row.lukePartnership,
            openToInvestorVisit: row.openToInvestorVisit,
            paratextRegistryId: row.paratextRegistryId,
            rev79CommunityId: row.rev79CommunityId,
            pnp: row.pnpId ? { id: row.pnpId } : null,
            sentPrintingDate: row.sentPrintingDate
              ? CalendarDate.fromISO(row.sentPrintingDate)
              : null,
            historicGoal: row.historicGoal,
            milestonePlanned: row.milestonePlanned,
            milestoneReached: row.milestoneReached,
            usingAIAssistedTranslation: row.usingAIAssistedTranslation,
          }
        : {
            intern: { id: row.internId },
            mentor: row.mentorId ? { id: row.mentorId } : null,
            position: row.position,
            methodologies: [...row.methodologies],
            countryOfOrigin: row.countryOfOriginId
              ? { id: row.countryOfOriginId }
              : null,
            growthPlan: row.growthPlanId ? { id: row.growthPlanId } : null,
            marketable: row.marketable,
            webId: row.webId,
          }),
    };
    return dto as UnsecuredDto<Engagement>;
  }
}

// Neo4j falls back from an override to the project's MOU date when the
// override isn't set; these mirror that COALESCE so sorting and filtering
// see the same "effective" date on both engines.
const effectiveStartDate = sql`coalesce(${engagements.startDateOverride}, (
  select "p"."mou_start" from "projects" "p"
  where "p"."id" = ${engagements.projectId}
))`;
const effectiveEndDate = sql`coalesce(${engagements.endDateOverride}, (
  select "p"."mou_end" from "projects" "p"
  where "p"."id" = ${engagements.projectId}
))`;

/**
 * How a sort expression reaches the engagement it is ordering by.
 *
 * A list of engagements sorts by its own row's columns directly. A list of
 * something that POINTS AT an engagement (progress reports) has no engagement
 * row in scope, so every value has to be read back through the foreign key.
 * One resolver serves both by asking its source for each column.
 */
interface EngagementSortSource {
  /** The engagement's id, for reaching further (its project, its language). */
  readonly id: SQL;
  /** Read one column off the engagement row. */
  readonly column: (column: AnyPgColumn) => SortEntry;
}

/** The engagement row the query itself is over. */
const ownEngagement: EngagementSortSource = {
  id: sql`${engagements.id}`,
  column: (column) => column,
};

/** The engagement a related row points at. */
const engagementVia = (engagementId: SQL): EngagementSortSource => ({
  id: engagementId,
  column: (column) => sql`(
    select ${column} from ${engagements}
    where ${engagements.id} = ${engagementId}
      and ${engagements.deletedAt} is null
  )`,
});

/** A related row's single text value, blank rather than null. */
const relatedText = (
  table: PgTable,
  column: AnyPgColumn,
  idColumn: AnyPgColumn,
  fk: SortEntry,
  deletedAt: AnyPgColumn,
): SQL => sql`coalesce((
  select ${column} from ${table}
  where ${idColumn} = ${fk} and ${deletedAt} is null
), '')`;

/**
 * The engagement's own sortable values, resolved against `source`.
 *
 * ⚠ `nameProjectFirst` / `nameProjectLast` are deliberately NOT collated,
 * which reverses what the comment that used to live here instructed. Neo4j
 * folds a name only where `DbSort` finds a transformer, and it looks that up as
 * (IEngagement, 'nameProjectLast') — a sort-only key with no DTO field behind
 * it, so there is no transformer and Neo4j orders these by raw code points.
 * Measured 2026-09-10 on two engagements whose languages are named `Zebra` and
 * `apple`: Neo4j returns `Zebra | apple` for both name keys (capitals first,
 * unfolded) while `project.name` returns `apple | Zebra` (folded, because THAT
 * key resolves to Project's `@NameField` name). Collating here would order the
 * grid's "Language / Intern" column differently from Neo4j.
 *
 * The concatenation itself mirrors `multiPropsAsSortString`: the parts are
 * glued with no separator and each missing one coalesces to an empty string,
 * so a language engagement sorts by its language name and an internship
 * engagement by its intern's display name.
 */
const engagementSortColumns = (
  source: EngagementSortSource,
): Record<string, SortColumns> => {
  // ⚠ DISPLAY name, where Neo4j reads the language's `name`. A DELIBERATE
  // divergence, decided 2026-09-10: the grid's "Language / Intern" column shows
  // `language.displayName`, so sorting by `name` puts rows in positions the
  // visible text cannot explain. On the scrubbed copy the two names differ for
  // all 3,624 languages, which makes the column look unsorted; on real data it
  // is the subset whose names diverge, which is what surfaced it.
  //
  // Same defect as the users list sorting by real name while showing the
  // display name — that one is still outstanding. This is the only sort in the
  // app that intentionally disagrees with Neo4j, so the engagement name test
  // asserts a different order per engine rather than one shared answer.
  const languageName = relatedText(
    languages,
    languages.displayName,
    languages.id,
    source.column(engagements.languageId),
    languages.deletedAt,
  );
  const projectName = relatedText(
    projects,
    projects.name,
    projects.id,
    source.column(engagements.projectId),
    projects.deletedAt,
  );
  const internFirst = relatedText(
    users,
    users.displayFirstName,
    users.id,
    source.column(engagements.internId),
    users.deletedAt,
  );
  const internLast = relatedText(
    users,
    users.displayLastName,
    users.id,
    source.column(engagements.internId),
    users.deletedAt,
  );
  const projectDate = (column: AnyPgColumn): SQL => sql`(
    select ${column} from ${projects}
    where ${projects.id} = ${source.column(engagements.projectId)}
      and ${projects.deletedAt} is null
  )`;
  return {
    id: source.column(engagements.id),
    status: source.column(engagements.status),
    createdAt: source.column(engagements.createdAt),
    modifiedAt: source.column(engagements.modifiedAt),
    type: source.column(engagements.type),
    // Neo4j falls back from an override to the project's MOU date.
    startDate: sql`coalesce(${source.column(
      engagements.startDateOverride,
    )}, ${projectDate(projects.mouStart)})`,
    endDate: sql`coalesce(${source.column(
      engagements.endDateOverride,
    )}, ${projectDate(projects.mouEnd)})`,
    statusModifiedAt: source.column(engagements.statusModifiedAt),
    lastSuspendedAt: source.column(engagements.lastSuspendedAt),
    lastReactivatedAt: source.column(engagements.lastReactivatedAt),
    completeDate: source.column(engagements.completeDate),
    disbursementCompleteDate: source.column(
      engagements.disbursementCompleteDate,
    ),
    initialEndDate: source.column(engagements.initialEndDate),
    // LanguageEngagement columns. Blank on an internship engagement, which
    // sorts it to the end — where Neo4j's unset property also puts it.
    firstScripture: source.column(engagements.firstScripture),
    lukePartnership: source.column(engagements.lukePartnership),
    openToInvestorVisit: source.column(engagements.openToInvestorVisit),
    paratextRegistryId: source.column(engagements.paratextRegistryId),
    historicGoal: source.column(engagements.historicGoal),
    milestonePlanned: source.column(engagements.milestonePlanned),
    milestoneReached: source.column(engagements.milestoneReached),
    usingAIAssistedTranslation: source.column(
      engagements.usingAIAssistedTranslation,
    ),
    sentPrintingDate: source.column(engagements.sentPrintingDate),
    // InternshipEngagement columns.
    position: source.column(engagements.position),
    nameProjectFirst: sql`${projectName} || ${languageName} || ${internFirst} || ${internLast}`,
    nameProjectLast: sql`${languageName} || ${internFirst} || ${internLast} || ${projectName}`,
  };
};

/** `'Progress'` as the `report_type` enum rather than an untyped string. */
const progressReportTypeLiteral = sql.raw(`'Progress'::"report_type"`);

/**
 * The current progress report due for the engagement in scope: the latest one
 * whose period has already ended. Mirror of Neo4j's `matchCurrentDue` — same
 * `end < today` predicate and same `end desc, start asc` tiebreak — returning
 * null where the engagement has no such report, which is what that matcher's
 * zero-reports arm returns.
 */
const currentProgressReportDue = (
  key: string,
  source: EngagementSortSource,
): SortColumns | undefined => {
  const column =
    periodicReportSortColumns[key as keyof typeof periodicReportSortColumns];
  if (!column) return undefined;
  return sql`(
    select ${column} from ${periodicReports}
    where ${periodicReports.engagementId} = ${source.id}
      and ${periodicReports.type} = ${progressReportTypeLiteral}
      and ${periodicReports.deletedAt} is null
      and ${periodicReports.end} < current_date
    order by ${periodicReports.end} desc, ${periodicReports.start} asc
    limit 1
  )`;
};

/**
 * Resolve an engagement sort key, including the prefixes Neo4j answers by
 * delegating to another domain's sorters: `project.*` (which itself reaches
 * `primaryLocation.*` and `fieldRegion.*`), `language.*`, and
 * `currentProgressReportDue.*`.
 *
 * ⚠ `project.name` is the DEFAULT sort of every engagement grid in cord-field
 * (`EngagementColumns[0].field`), sent on mount before anything is cached — so
 * until this resolved, every engagement list came back in creation order on
 * Postgres while Neo4j ordered it by project name.
 *
 * `engagementId` is for callers sorting THROUGH an engagement (progress
 * reports); omit it when the query is over `engagements` itself.
 *
 * Returns undefined for an unsupported key, leaving the caller's fallback in
 * place. `project.isMember` / `project.pinned` land there on purpose: no
 * repository defines a Neo4j sorter for either, so Neo4j answers them with an
 * EMPTY list (its required property match eliminates every row) and there is
 * no working behavior to mirror.
 */
export const engagementSortEntry = (
  sort: string,
  engagementId?: SQL,
): SortColumns | undefined => {
  const source = engagementId ? engagementVia(engagementId) : ownEngagement;
  if (sort.startsWith('project.')) {
    return projectSortEntry(
      sort.slice('project.'.length),
      sql`${source.column(engagements.projectId)}`,
    );
  }
  if (sort.startsWith('language.')) {
    return languageSortEntry(
      sort.slice('language.'.length),
      sql`${source.column(engagements.languageId)}`,
    );
  }
  if (sort.startsWith('currentProgressReportDue.')) {
    return currentProgressReportDue(
      sort.slice('currentProgressReportDue.'.length),
      source,
    );
  }
  // The engagement's `sensitivity` IS the project's — Neo4j's matcher reads it
  // through the project too, so this is the project sort under another name.
  if (sort === 'sensitivity') {
    return projectSortEntry(
      'sensitivity',
      sql`${source.column(engagements.projectId)}`,
    );
  }
  return engagementSortColumns(source)[sort];
};

const engagementDateFilterConditions = (
  effectiveDate: SQL,
  fieldName: 'startDate' | 'endDate',
  filter: DateFilter | undefined,
): SQL[] => {
  if (!filter) return [];
  if (filter.isNull != null) {
    throw new NotImplementedException(
      `EngagementFilters.${fieldName}.isNull is not implemented for postgres yet`,
    );
  }
  return [
    ...(filter.after ? [gt(effectiveDate, filter.after.toISODate())] : []),
    ...(filter.afterInclusive
      ? [gte(effectiveDate, filter.afterInclusive.toISODate())]
      : []),
    ...(filter.before ? [lt(effectiveDate, filter.before.toISODate())] : []),
    ...(filter.beforeInclusive
      ? [lte(effectiveDate, filter.beforeInclusive.toISODate())]
      : []),
  ];
};

// Intern name-match, reused by both `name` (also matches the project and
// language name) and `engagedName` (engaged entity only).
const engagedEntityUserNameMatch = (term: string) =>
  or(
    ilike(users.realFirstName, term),
    ilike(users.realLastName, term),
    ilike(users.displayFirstName, term),
    ilike(users.displayLastName, term),
  )!;

/**
 * Column-level WHERE clauses for `EngagementFilters`. All fields are
 * implemented, including the project/language/intern sub-filter composition
 * and the tool sub-filter (via `toolUsages`).
 */
export const engagementFilterClauses = (
  db: DrizzleDb,
  filter: EngagementListInput['filter'],
  requesterId?: ID<'User'>,
): SQL[] => {
  const conditions: SQL[] = [];
  if (!filter) return conditions;
  if (filter.type) {
    conditions.push(
      eq(
        engagements.type,
        filter.type === 'language' ? 'Language' : 'Internship',
      ),
    );
  }
  if (filter.status?.length) {
    conditions.push(inArray(engagements.status, [...filter.status]));
  }
  if (filter.project) {
    conditions.push(
      subFilter(
        db,
        engagements.projectId,
        projects,
        projectFilterClauses(db, filter.project, requesterId),
      ),
    );
  }
  if (filter.languageId) {
    conditions.push(eq(engagements.languageId, filter.languageId));
  }
  if (filter.partnerId) {
    conditions.push(
      sql`exists (
        select 1 from "partnerships" "ps"
        where "ps"."project_id" = ${engagements.projectId}
          and "ps"."partner_id" = ${filter.partnerId}
          and "ps"."deleted_at" is null
      )`,
    );
  }
  if (filter.marketable !== undefined) {
    conditions.push(eq(engagements.marketable, filter.marketable));
  }
  if (filter.milestoneReached !== undefined) {
    conditions.push(eq(engagements.milestoneReached, filter.milestoneReached));
  }
  if (filter.milestonePlanned?.length) {
    conditions.push(
      inArray(engagements.milestonePlanned, [...filter.milestonePlanned]),
    );
  }
  if (filter.usingAIAssistedTranslation?.length) {
    conditions.push(
      inArray(engagements.usingAIAssistedTranslation, [
        ...filter.usingAIAssistedTranslation,
      ]),
    );
  }
  if (filter.language) {
    conditions.push(
      subFilter(
        db,
        engagements.languageId,
        languages,
        languageFilterClauses(db, filter.language, requesterId),
      ),
    );
  }
  if (filter.intern) {
    conditions.push(
      subFilter(
        db,
        engagements.internId,
        users,
        userFilterClauses(db, filter.intern),
      ),
    );
  }
  if (filter.tool) {
    conditions.push(
      inArray(
        engagements.id,
        db
          .selectDistinct({ id: toolUsages.containerId })
          .from(toolUsages)
          .innerJoin(
            tools,
            and(eq(tools.id, toolUsages.toolId), isNull(tools.deletedAt)),
          )
          .where(
            and(
              isNull(toolUsages.deletedAt),
              ...toolFilterClauses(db, filter.tool),
            ),
          ),
      ),
    );
  }
  if (filter.name) {
    const term = `%${escapeLikePattern(filter.name)}%`;
    const matchingProjectIds = db
      .select({ id: projects.id })
      .from(projects)
      .where(ilike(projects.name, term));
    const matchingLanguageIds = db
      .select({ id: languages.id })
      .from(languages)
      .where(
        or(ilike(languages.name, term), ilike(languages.displayName, term)),
      );
    const matchingInternIds = db
      .select({ id: users.id })
      .from(users)
      .where(engagedEntityUserNameMatch(term));
    conditions.push(
      or(
        inArray(engagements.projectId, matchingProjectIds),
        inArray(engagements.languageId, matchingLanguageIds),
        inArray(engagements.internId, matchingInternIds),
      )!,
    );
  }
  if (filter.engagedName) {
    const term = `%${escapeLikePattern(filter.engagedName)}%`;
    const matchingLanguageIds = db
      .select({ id: languages.id })
      .from(languages)
      .where(
        or(ilike(languages.name, term), ilike(languages.displayName, term)),
      );
    const matchingInternIds = db
      .select({ id: users.id })
      .from(users)
      .where(engagedEntityUserNameMatch(term));
    conditions.push(
      or(
        inArray(engagements.languageId, matchingLanguageIds),
        inArray(engagements.internId, matchingInternIds),
      )!,
    );
  }
  conditions.push(
    ...engagementDateFilterConditions(
      effectiveStartDate,
      'startDate',
      filter.startDate,
    ),
    ...engagementDateFilterConditions(
      effectiveEndDate,
      'endDate',
      filter.endDate,
    ),
  );
  return conditions;
};
