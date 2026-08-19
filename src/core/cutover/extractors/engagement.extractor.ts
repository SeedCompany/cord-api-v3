import { type ID } from '~/common';
import {
  ceremonies,
  ceremonyTypeEnum,
  engagements,
  engagementStatusEnum,
  engagementStatusHistory,
  fileNodes,
  languages,
  locations,
  productMethodologyEnum,
  projects,
  users,
} from '~/core/drizzle/schema';
import { CeremonyRepository } from '../../../components/ceremony/ceremony.repository';
import { type Ceremony } from '../../../components/ceremony/dto';
import { type Engagement } from '../../../components/engagement/dto';
import { EngagementRepository } from '../../../components/engagement/engagement.repository';
import {
  bulkInsert,
  cypher,
  dateStr,
  fetchIds,
  keepLanded,
  linkId,
  liveTargetIds,
  orDefault,
  readAllViaRepo,
  sanitizeEnum,
  stat,
  ts,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Engagement cluster — engagements (single-table inheritance over
 * LanguageEngagement / InternshipEngagement) + engagement_status_history +
 * ceremonies (1:1).
 *
 * This wave has more ways to fail than any before it, because `engagements`
 * carries a type-shape CHECK on top of five FKs to tables that legitimately drop
 * rows:
 *
 *   engagements_type_shape_chk:
 *     Language   ⟹ language_id NOT NULL AND intern_id IS NULL
 *     Internship ⟹ intern_id   NOT NULL AND language_id IS NULL
 *
 * So for a Language engagement whose language never landed there is no
 * null-and-continue option — the CHECK forbids it and the row must be DROPPED.
 * Same for an Internship whose intern never landed. That is real data loss, so
 * both are counted and logged with ids rather than absorbed. `mentor_id` and
 * `country_of_origin_id` ARE nullable, so those get nulled instead.
 *
 * Type comes from the Neo4j label (`LanguageEngagement` / `InternshipEngagement`)
 * rather than the DTO's `__typename` string, which is prefixed `default::` for
 * Gel's benefit and is a fragile thing to parse.
 *
 * `pnp_id` / `growth_plan_id` are backfilled from the same `pnp`/`growthPlan`
 * properties the live repo already hydrates (`props.pnp` / `props.growthPlan` —
 * plain DefinedFile placeholder ids, not a graph relationship). `file` is added
 * to `dependsOn` so file_nodes has landed by the time these are checked for
 * liveness.
 */
export const engagementExtractor: Extractor = {
  name: 'engagement',
  targetTables: ['engagements', 'engagement_status_history', 'ceremonies'],
  dependsOn: ['project', 'language', 'user', 'location', 'file'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const dtos = await readAllViaRepo<Engagement>(
      ctx,
      'Engagement',
      EngagementRepository,
    );

    // Label-driven discriminator — see the docblock.
    const languageEngagementIds = new Set<string>(
      await fetchIds(ctx, 'LanguageEngagement'),
    );

    const landedProjects = await liveTargetIds(ctx, 'Project', projects);
    const landedLanguages = await liveTargetIds(ctx, 'Language', languages);
    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const landedLocations = await liveTargetIds(ctx, 'Location', locations);
    const landedFileNodes = await liveTargetIds(ctx, 'FileNode', fileNodes);

    const droppedForProject: string[] = [];
    const droppedForLanguage: string[] = [];
    const droppedForIntern: string[] = [];
    const nulledEnums = new Set<string>();
    let nulledMentors = 0;
    let nulledCountries = 0;
    let nulledFileRefs = 0;
    const liveFileRefOrNull = (id: ID | null): ID | null => {
      if (id && !landedFileNodes.has(id)) {
        nulledFileRefs++;
        return null;
      }
      return id;
    };

    const rows = dtos.flatMap((eng) => {
      const isLanguage = languageEngagementIds.has(eng.id);
      const projectId = eng.project?.id;
      if (!projectId || !landedProjects.has(projectId)) {
        droppedForProject.push(eng.id);
        return [];
      }

      // migration-todo: the DTO splits Language/Internship fields by subtype, so
      // reading the other half needs a cast. The shape is guaranteed by the
      // label check above.
      const lang = eng as unknown as Record<string, any>;

      const languageId = isLanguage
        ? (linkId(lang.language as { id: ID<'Language'> } | null) ?? null)
        : null;
      if (isLanguage && (!languageId || !landedLanguages.has(languageId))) {
        droppedForLanguage.push(eng.id);
        return [];
      }

      const internId = !isLanguage
        ? (linkId(lang.intern as { id: ID<'User'> } | null) ?? null)
        : null;
      if (!isLanguage && (!internId || !landedUsers.has(internId))) {
        droppedForIntern.push(eng.id);
        return [];
      }

      let mentorId = !isLanguage
        ? (linkId(lang.mentor as { id: ID<'User'> } | null) ?? null)
        : null;
      if (mentorId && !landedUsers.has(mentorId)) {
        mentorId = null;
        nulledMentors++;
      }
      let countryOfOriginId = !isLanguage
        ? (linkId(lang.countryOfOrigin as { id: ID<'Location'> } | null) ??
          null)
        : null;
      if (countryOfOriginId && !landedLocations.has(countryOfOriginId)) {
        countryOfOriginId = null;
        nulledCountries++;
      }

      const status = sanitizeEnum(
        [orDefault(eng.status as string, 'InDevelopment')],
        engagementStatusEnum.enumValues,
      );
      if (status.dropped.length > 0) {
        for (const value of status.dropped) nulledEnums.add(`status=${value}`);
      }
      const methodologies = sanitizeEnum(
        [...((lang.methodologies as string[] | undefined) ?? [])],
        productMethodologyEnum.enumValues,
      );
      for (const value of methodologies.dropped) {
        nulledEnums.add(`methodology=${value}`);
      }

      const type: 'Language' | 'Internship' = isLanguage
        ? 'Language'
        : 'Internship';
      return [
        {
          id: eng.id,
          projectId,
          type,
          // A legacy status outside the enum falls back to the column default
          // rather than aborting the chunk.
          status: status.kept[0] ?? ('InDevelopment' as const),
          statusModifiedAt: ts(eng.statusModifiedAt),
          lastSuspendedAt: ts(eng.lastSuspendedAt),
          lastReactivatedAt: ts(eng.lastReactivatedAt),
          completeDate: dateStr(eng.completeDate),
          disbursementCompleteDate: dateStr(eng.disbursementCompleteDate),
          startDateOverride: dateStr(lang.startDateOverride),
          endDateOverride: dateStr(lang.endDateOverride),
          initialEndDate: dateStr(eng.initialEndDate),
          description: eng.description ?? null,

          // ── LanguageEngagement ──
          languageId,
          firstScripture: (lang.firstScripture as boolean | null) ?? null,
          lukePartnership: (lang.lukePartnership as boolean | null) ?? null,
          openToInvestorVisit:
            (lang.openToInvestorVisit as boolean | null) ?? null,
          paratextRegistryId:
            (lang.paratextRegistryId as string | null) ?? null,
          rev79CommunityId: (lang.rev79CommunityId as string | null) ?? null,
          pnpId: liveFileRefOrNull(linkId(lang.pnp)),
          sentPrintingDate: dateStr(lang.sentPrintingDate),
          historicGoal: (lang.historicGoal as string | null) ?? null,
          milestonePlanned: orDefault(
            lang.milestonePlanned,
            'Unknown' as const,
          ),
          milestoneReached: (lang.milestoneReached as boolean | null) ?? null,
          usingAIAssistedTranslation: orDefault(
            lang.usingAIAssistedTranslation,
            'Unknown' as const,
          ),

          // ── InternshipEngagement ──
          internId,
          mentorId,
          position: lang.position ?? null,
          methodologies: methodologies.kept as any,
          countryOfOriginId,
          growthPlanId: liveFileRefOrNull(linkId(lang.growthPlan)),
          marketable: orDefault(lang.marketable as boolean, false),
          webId: (lang.webId as string | null) ?? null,

          createdAt: tsReq(eng.createdAt),
          modifiedAt: tsReq(eng.modifiedAt),
          updatedAt: tsReq(eng.modifiedAt),
          deletedAt: null,
        },
      ];
    });

    for (const [reason, ids] of [
      ['their project never landed', droppedForProject],
      [
        'they are a LanguageEngagement whose language never landed (type-shape CHECK forbids a null language_id)',
        droppedForLanguage,
      ],
      [
        'they are an InternshipEngagement whose intern never landed (type-shape CHECK forbids a null intern_id)',
        droppedForIntern,
      ],
    ] as const) {
      if (ids.length > 0) {
        ctx.log(
          `    ⚠ DROPPED ${ids.length} engagement(s) because ${reason}: ` +
            `${ids.slice(0, 10).join(', ')}${ids.length > 10 ? ', …' : ''}`,
        );
      }
    }
    if (nulledMentors > 0 || nulledCountries > 0) {
      ctx.log(
        `    ⚠ nulled ${nulledMentors} mentor + ${nulledCountries} countryOfOrigin ref(s) whose target never landed`,
      );
    }
    if (nulledFileRefs > 0) {
      ctx.log(
        `    ⚠ nulled ${nulledFileRefs} pnp/growthPlan ref(s) whose file never landed`,
      );
    }
    if (nulledEnums.size > 0) {
      ctx.log(
        `    ⚠ dropped unknown engagement enum value(s): ${[...nulledEnums].join(', ')} — migration-todo: map, don't drop`,
      );
    }

    // Live-unique pre-warning: (project, language) and (project, intern) are
    // unique among live rows, and everything here is live.
    for (const [label, key] of [
      ['(project, language)', (r: (typeof rows)[number]) => r.languageId],
      ['(project, intern)', (r: (typeof rows)[number]) => r.internId],
    ] as const) {
      const seen = new Map<string, ID>();
      const collisions: string[] = [];
      for (const row of rows) {
        const other = key(row);
        if (other == null) continue;
        const composite = `${row.projectId}::${other}`;
        const first = seen.get(composite);
        if (first) collisions.push(`${row.id} (dup of ${first})`);
        else seen.set(composite, row.id);
      }
      if (collisions.length > 0) {
        ctx.log(
          `    ⚠ ${collisions.length} engagement(s) collide on the ${label} live-unique index and will be ` +
            `DROPPED by onConflictDoNothing: ${collisions.slice(0, 10).join(', ')}` +
            (collisions.length > 10 ? ', …' : ''),
        );
      }
    }

    out.engagements = stat(
      dtos.length,
      await bulkInsert(ctx, engagements, rows),
    );

    // ── engagement_status_history ────────────────────────────────────────────
    // Neo4j keeps status history as DEACTIVATED `status` property rels; the live
    // status is the one active rel. Newest-first ordering is the consumer's job
    // (the rules engine's BackTo transitions read this table), so just carry the
    // timestamps faithfully.
    //
    // DO NOT put a `:Property` label filter on the target node. Superseding a
    // property relabels its node — `deactivateProperty` and `commitChangesetProps`
    // both call `prefixNodeLabelsWithDeleted`, which REMOVES every label and
    // re-adds it prefixed — so a superseded status node is `Deleted_Property` and
    // matches `:Property` never again. This mirrors the app's own Neo4j read in
    // `engagement.rules.ts` (`getPreviousStatus`), which is label-free for the same
    // reason and defines what "previous statuses" means here.
    //
    // MEASURED ON PRODUCTION 2026-08-19, because the filter's cost is not obvious
    // from reading it — it does not read zero, it reads a misleading minority:
    //   13,558 rows on `Deleted_Property` (superseded — invisible to the filter)
    //      903 rows on a bare `Property`  (visible to the filter)
    // and 5,136 of 8,235 engagements have history while the filtered query finds
    // it for only 502 of them. So the filtered read carried ~6% of the history and
    // reconciled ✓, because read and inserted agree when the read itself is short.
    //
    // The 903 bare-`Property` rows are NOT pending changeset drafts — production
    // has zero of those (no row had a `:changeset` edge). The full label census
    // splits them, and the split is readable because `createProperty` gives a
    // property its domain label (`EngagementStatus`) only when it is created
    // OUTSIDE a changeset:
    //   ["Deleted_Property","Deleted_EngagementStatus"] 12,893 — ordinary history
    //   ["Deleted_Property"]                               665 — began as a
    //       changeset proposal, was committed, later superseded — still history
    //   ["Property","EngagementStatus"]                    401 — deactivated but
    //       never relabelled, i.e. history predating the label-prefixing behaviour
    //   ["Property"]                                       502 — began as a
    //       changeset proposal and was never committed (rejecting a changeset
    //       removes the `:changeset` edge but leaves the node)
    // Only that last group is arguably not history. It is carried anyway, because
    // Neo4j's own `getPreviousStatus` counts it and the cutover's job is to agree
    // with the source, not to improve on it — but it is counted and reported so
    // the question can be settled post-cutover on a real number.
    //
    // `deletedAt` is stamped on the property NODE, never on the rel, so `at`
    // comes from `p.deletedAt` — the moment the status was superseded, which is
    // what the Postgres write side records going forward (the drizzle repo
    // inserts the OLD status and lets `at` default to now at change time). The
    // remaining arms are begin-time fallbacks for rows that predate that.
    const historyRows = await cypher<{
      engagementId: ID<'Engagement'>;
      status: string;
      at: string | null;
      neverCommitted: boolean;
    }>(
      ctx,
      `MATCH (e:Engagement)-[r:status { active: false }]->(p)
       RETURN e.id AS engagementId, p.value AS status,
              toString(coalesce(p.deletedAt, r.createdAt, p.createdAt)) AS at,
              (NOT p:Deleted_Property AND NOT p:EngagementStatus) AS neverCommitted`,
    );
    const landedEngagements = await liveTargetIds(
      ctx,
      'Engagement',
      engagements,
    );
    // Statuses that only ever existed as an uncommitted changeset proposal — see
    // the label census above. Carried, not dropped, so Postgres agrees with the
    // source, but counted so the "should a rejected proposal count as history"
    // question can be answered post-cutover against a real number (502 in prod).
    const neverCommitted = historyRows.filter(
      (row) => row.neverCommitted,
    ).length;
    if (neverCommitted > 0) {
      ctx.log(
        `    ℹ ${neverCommitted} status-history row(s) only ever existed as an uncommitted ` +
          `changeset proposal — carried because Neo4j's own BackTo read counts them too ` +
          `(engagement.rules.ts getPreviousStatus). migration-todo(post-cutover): decide ` +
          `whether a rejected proposal belongs in an engagement's status history.`,
      );
    }

    const knownStatuses = new Set<string>(engagementStatusEnum.enumValues);
    const typedHistory = historyRows.filter((row) =>
      knownStatuses.has(row.status),
    );
    const untypedStatuses = historyRows.length - typedHistory.length;
    if (untypedStatuses > 0) {
      const offenders = [
        ...new Set(
          historyRows
            .filter((row) => !knownStatuses.has(row.status))
            .map((row) => String(row.status)),
        ),
      ];
      ctx.log(
        `    ⚠ DROPPED ${untypedStatuses} status-history row(s) carrying a status outside ` +
          `engagement_status: ${offenders.slice(0, 10).join(', ')}` +
          (offenders.length > 10 ? ', …' : ''),
      );
    }

    const history = keepLanded(typedHistory, [
      [landedEngagements, (row) => row.engagementId],
    ]);
    if (history.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${history.skipped} status-history row(s) whose engagement never landed`,
      );
    }
    out.engagement_status_history = stat(
      historyRows.length,
      await bulkInsert(
        ctx,
        engagementStatusHistory,
        history.kept.map((row) => ({
          engagementId: row.engagementId,
          status: row.status as any,
          // `at` is NOT NULL with a defaultNow(); a history rel with no usable
          // timestamp is better dated now than dropped.
          //
          // Must go through `ts`, NOT `new Date(row.at)`. Raw Cypher results are
          // still passed through the connection's transformer, so `at` arrives as
          // a Luxon value — and `new Date(<object>)` yields an INVALID date rather
          // than failing, which Postgres only rejects later, as a RangeError from
          // deep inside the driver. This path has no rows locally, so it went
          // unexercised until a production-volume load.
          at: ts(row.at) ?? new Date(),
        })),
      ),
    );

    // ── ceremonies (1:1 with engagement) ────────────────────────────────────
    const ceremonyDtos = await readAllViaRepo<Ceremony>(
      ctx,
      'Ceremony',
      CeremonyRepository,
    );
    const ceremonyPairs = await cypher<{
      cid: ID<'Ceremony'>;
      eid: ID<'Engagement'>;
    }>(
      ctx,
      `MATCH (e:Engagement)-[:ceremony { active: true }]->(c:Ceremony)
       RETURN c.id AS cid, e.id AS eid`,
    );
    const engagementOf = new Map(ceremonyPairs.map((p) => [p.cid, p.eid]));
    const knownCeremonyTypes = new Set<string>(ceremonyTypeEnum.enumValues);
    let ceremoniesWithoutEngagement = 0;
    let ceremoniesBadType = 0;
    const ceremonyRows = ceremonyDtos.flatMap((cer) => {
      const engagementId = engagementOf.get(cer.id);
      if (!engagementId || !landedEngagements.has(engagementId)) {
        // engagement_id is NOT NULL, so an orphan ceremony cannot be written.
        ceremoniesWithoutEngagement++;
        return [];
      }
      if (!knownCeremonyTypes.has(cer.type)) {
        ceremoniesBadType++;
        return [];
      }
      return [
        {
          id: cer.id,
          engagementId,
          type: cer.type,
          planned: orDefault(cer.planned, false),
          estimatedDate: dateStr(cer.estimatedDate),
          actualDate: dateStr(cer.actualDate),
          createdAt: tsReq(cer.createdAt),
          updatedAt: tsReq(cer.createdAt),
          deletedAt: null,
        },
      ];
    });
    if (ceremoniesWithoutEngagement > 0) {
      ctx.log(
        `    ⚠ skipped ${ceremoniesWithoutEngagement} ceremony(ies) with no landed engagement (engagement_id is NOT NULL)`,
      );
    }
    if (ceremoniesBadType > 0) {
      ctx.log(
        `    ⚠ skipped ${ceremoniesBadType} ceremony(ies) with a type outside the ceremony_type enum`,
      );
    }
    out.ceremonies = stat(
      ceremonyDtos.length,
      await bulkInsert(ctx, ceremonies, ceremonyRows),
    );

    return out;
  },
};
