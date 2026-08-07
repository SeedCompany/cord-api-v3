import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  CalendarDate,
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
  resolveOrderBy,
  type SortMap,
  subFilter,
} from '~/core/drizzle';
import { type DrizzleDb, DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  engagementStatusHistory,
  languages,
  projects,
  tools,
  toolUsages,
  users,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { FileService } from '../file';
import { languageFilterClauses } from '../language/language.drizzle.repository';
import { IProject } from '../project/dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  projectFilterClauses,
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
    conditions.push(...engagementFilterClauses(this.db, input.filter));

    const sortColumns = {
      status: engagements.status,
      createdAt: engagements.createdAt,
      modifiedAt: engagements.modifiedAt,
      type: engagements.type,
      // startDate/endDate coalesce with the project's mou window.
      startDate: sql`coalesce(${engagements.startDateOverride}, (
        select "p"."mou_start" from "projects" "p"
        where "p"."id" = ${engagements.projectId}
      ))`,
      endDate: sql`coalesce(${engagements.endDateOverride}, (
        select "p"."mou_end" from "projects" "p"
        where "p"."id" = ${engagements.projectId}
      ))`,
      // migration-todo: nameProjectFirst/nameProjectLast, sensitivity,
      // language.* / project.* delegated sorts, currentProgressReportDue.*.
      // Unknown keys fall back to createdAt.
      //
      // ⚠️ Whoever adds nameProjectFirst/nameProjectLast: they sort by TEXT and
      // they have to be `sql` expressions (Neo4j builds them by concatenating a
      // project's name with its language names, so there is no single column to
      // point at). `displayOrder()` cannot see inside an expression — it
      // collates COLUMNS — so an expression comes back uncollated with no error
      // and nothing failing, and would order differently from every other list
      // in the app. Write `collate "display_order"` inline in the expression.
      // The two entries above are exempt only because they sort dates.
    } as unknown as SortMap<keyof Engagement>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, engagements.createdAt),
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

/**
 * Column-level WHERE clauses for `EngagementFilters`. Implemented: type,
 * status, project id, languageId, partnerId, marketable, milestoneReached,
 * milestonePlanned, usingAIAssistedTranslation. The rest THROW rather than
 * silently ignore (the discoverability convention — a silently-dropped filter
 * returns the full unfiltered set and nothing catches it).
 * migration-todo: implement the throwing ones as their domains land —
 * name/engagedName (language/user name joins), startDate/endDate ranges
 * (COALESCE with the project mou window), tool sub-filter (ToolUsage not
 * migrated). project/language/intern sub-filter composition is wired below,
 * now that Project/Language/User have all landed.
 */
export const engagementFilterClauses = (
  db: DrizzleDb,
  filter: EngagementListInput['filter'],
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
        projectFilterClauses(db, filter.project),
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
        languageFilterClauses(db, filter.language),
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
  const unimplemented = {
    name: filter.name,
    engagedName: filter.engagedName,
    startDate: filter.startDate,
    endDate: filter.endDate,
  };
  for (const [key, value] of Object.entries(unimplemented)) {
    if (value !== undefined) {
      throw new NotImplementedException(
        `EngagementFilters.${key} is not implemented for postgres yet`,
      );
    }
  }
  return conditions;
};
