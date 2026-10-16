import { Injectable } from '@nestjs/common';
import { and, inArray, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID, type Sensitivity } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { projects } from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { type ProjectType, resolveProjectType } from './dto';

/** A project whose sensitivity a recompute changed. */
export interface ProjectSensitivityChange {
  readonly id: ID<'Project'>;
  readonly type: ProjectType;
  readonly previous: Sensitivity;
  readonly sensitivity: Sensitivity;
  /** The project's new `modifiedAt`. */
  readonly at: DateTime;
}

/**
 * Keeps the denormalized `projects.sensitivity` of translation projects current
 * from their engaged languages — max(language sensitivity) ?? High. Mirror of
 * Gel's recalculateProjectSens triggers; the engagement and language
 * repositories call it whenever the inputs change (create/delete engagement,
 * language sensitivity update, language delete). Internship projects are
 * untouched — they read own_sensitivity. So are soft-deleted projects: a
 * project's delete leaves its engagements live, so a language change still
 * reaches it, but nothing reads its sensitivity and no subscriber can load it.
 *
 * A project whose sensitivity actually changes gets a new `modifiedAt`, so
 * `modifiedAt` pollers see a change no one made to the project directly, and
 * its live queries are invalidated.
 *
 * It runs in the repositories, not their services, because the recompute has
 * to land before the calling repository's `readOne`: an engagement's
 * `sensitivity` is read from its project's row, and a language's
 * `effectiveSensitivity` from its projects'. Announcing the change is a
 * service's job, so the changes are returned for the calling service to pass
 * to `ProjectService.publishSensitivityChanges`.
 */
@Injectable()
export class ProjectSensitivityRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  async recompute(
    projectIds: ReadonlyArray<ID<'Project'>>,
  ): Promise<readonly ProjectSensitivityChange[]> {
    if (projectIds.length === 0) return [];

    // Row lock, in a statement of its own, so concurrent recomputes of the
    // same project serialize. Without it, the recompute below reads the
    // project and its engagements from a snapshot taken before another
    // recompute of that project committed: it reports a stale `previous`, or
    // skips a write it needed. The lock waits for that transaction to
    // commit, and the next statement then gets a fresh snapshot. Locking in
    // id order keeps two multi-project recomputes (a language edit fans out)
    // from deadlocking.
    // It only orders recomputes of a project already in `projectIds`. A
    // language edit picks its projects before any lock, so it can miss a
    // project engaging that language concurrently, whose own recompute still
    // reads the language's old sensitivity.
    // NO KEY UPDATE, not UPDATE: inserting an engagement takes FOR KEY SHARE
    // on its project for the foreign key, and FOR UPDATE conflicts with that,
    // so two engagement creates on one project would deadlock here. NO KEY
    // UPDATE is the lock the UPDATE below takes anyway, and it still
    // conflicts with itself, so recomputes stay serialized.
    await this.drizzle.client
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(inArray(projects.id, [...projectIds]), isNull(projects.deletedAt)),
      )
      .orderBy(projects.id)
      .for('no key update');

    // Stamped here, after the lock and on the app's clock like every other
    // project write, so it can't predate an update the lock just waited for.
    // Postgres's now() is the transaction's start, which could. It's returned
    // as the event's `at`, so that matches the stored modifiedAt exactly.
    const at = DateTime.now();

    // The CTE computes each project's new value once and captures its current
    // one before the update, so unchanged rows are skipped and RETURNING can
    // give both sides of the change.
    const { rows: changed } = await this.drizzle.client.execute<{
      id: ID<'Project'>;
      type: ProjectType;
      previous: Sensitivity;
      sensitivity: Sensitivity;
    }>(sql`
      with "recomputed" as (
        select "p"."id", "p"."sensitivity" as "previous", coalesce((
          select max("l"."sensitivity") from "engagements" "e"
          join "languages" "l" on "l"."id" = "e"."language_id"
          where "e"."project_id" = "p"."id"
            and "e"."deleted_at" is null
            and "l"."deleted_at" is null
        ), 'High') as "sensitivity"
        from "projects" "p"
        where "p"."id" in (${sql.join(
          projectIds.map((id) => sql`${id}`),
          sql`, `,
        )})
          and "p"."type" <> 'Internship'
          and "p"."deleted_at" is null
      )
      update "projects" set
        "sensitivity" = "recomputed"."sensitivity",
        "modified_at" = ${at.toJSDate()},
        "updated_at" = ${at.toJSDate()}
      from "recomputed"
      where "projects"."id" = "recomputed"."id"
        and "recomputed"."sensitivity" is distinct from "recomputed"."previous"
      returning "projects"."id", "projects"."type",
        "recomputed"."previous", "projects"."sensitivity"
    `);
    if (changed.length === 0) return [];

    this.liveQueryStore.invalidateAll(
      changed.map((row) => [resolveProjectType(row), row.id] as const),
    );
    return changed.map((row) => ({ ...row, at }));
  }
}
