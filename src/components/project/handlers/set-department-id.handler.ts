import { Injectable } from '@nestjs/common';
import { and, eq, isNull as isNullColumn, sql } from 'drizzle-orm';
import { ClientException, ServerException, type UnsecuredDto } from '~/common';
import { TransactionRetryInformer } from '~/core/database';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { isUniqueViolation } from '~/core/drizzle/errors';
import { partners, partnerships, projects } from '~/core/drizzle/schema';
import { OnHook } from '~/core/hooks';
import {
  type Project,
  ProjectStatus as Status,
  ProjectStep as Step,
} from '../dto';
import { ProjectUpdatedHook } from '../hooks';
import { ProjectTransitionedHook } from '../workflow/hooks/project-transitioned.hook';

@Injectable()
export class SetDepartmentId {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly retryInformer: TransactionRetryInformer,
  ) {}

  @OnHook(ProjectTransitionedHook)
  @OnHook(ProjectUpdatedHook)
  async handle(event: ProjectTransitionedHook | ProjectUpdatedHook) {
    const project =
      event instanceof ProjectTransitionedHook ? event.project : event.updated;

    const { status, step } = project;

    const shouldSetDepartmentId =
      !project.departmentId &&
      Status.indexOf(status) <= Status.indexOf('Active') &&
      Step.indexOf(step) >= Step.indexOf('PendingFinanceConfirmation');
    if (!shouldSetDepartmentId) {
      return;
    }

    const departmentId = await this.assignDepartmentId(project);

    const changed = { ...project, departmentId };
    if (event instanceof ProjectTransitionedHook) {
      event.project = changed;
    } else {
      event.updated = changed;
    }
  }

  /**
   * Resolves the DepartmentIdBlock via one of two FK chains,
   * enumerates the block's `range int4multirange`, picks the smallest
   * 5-digit-padded id that isn't already used, and UPDATEs
   * `projects.department_id`. Catches PG unique violation 23505 on the
   * partial-unique index and marks the transaction for retry.
   *
   * MultiplicationTranslation projects route via
   * `partnerships (primary) → partners.department_id_block_id`; everything
   * else via `project.primary_location_id → locations.funding_account_id →
   * funding_accounts.department_id_block_id`. `project.primaryPartnership`
   * is a hard-coded null stub on the hydrate (unlike `primaryLocation`,
   * which is real) — a `!project.primaryPartnership` precondition check
   * would false-positive for every Multiplication project. The
   * primary-partnership branch below queries `partnerships`/`partners`
   * directly instead.
   *
   * `funding_accounts` / `department_id_blocks` / `locations` / `partnerships` /
   * `partners` are all present on the recut base, so both FK chains resolve.
   * Raw SQL is used for the enumeration itself — `unnest(range)` + `lateral
   * generate_series` over the `int4multirange` don't have a clean
   * query-builder form.
   *
   * `external_department_ids` — the IDs Intacct already holds — is unioned into
   * the used set. It is a flat reservation list
   * with no owner and no lifecycle, so it needs no domain of its own; see
   * migration 0040.
   */
  private async assignDepartmentId(project: UnsecuredDto<Project>) {
    const isMultiplication = project.type === 'MultiplicationTranslation';
    const projectId = project.id;

    let blockRangeJoin: ReturnType<typeof sql>;
    if (isMultiplication) {
      const [primaryPartner] = await this.drizzle.client
        .select({ departmentIdBlockId: partners.departmentIdBlockId })
        .from(partnerships)
        .innerJoin(partners, eq(partners.id, partnerships.partnerId))
        .where(
          and(
            eq(partnerships.projectId, projectId),
            eq(partnerships.primary, true),
            isNullColumn(partnerships.deletedAt),
            isNullColumn(partners.deletedAt),
          ),
        )
        .limit(1);
      if (!primaryPartner) {
        throw new ClientException(
          'Project must have a partnership to continue',
        );
      }
      if (!primaryPartner.departmentIdBlockId) {
        throw new ClientException(
          "Project's primary partner does not have a department ID blocks declared",
        );
      }
      blockRangeJoin = sql`
        join partnerships ps on ps.project_id = p.id
          and ps."primary" = true
          and ps.deleted_at is null
        join partners pn on pn.id = ps.partner_id
          and pn.deleted_at is null
        join department_id_blocks b on b.id = pn.department_id_block_id
      `;
    } else {
      if (!project.primaryLocation) {
        throw new ClientException(
          'Project must have a primary location to continue',
        );
      }
      blockRangeJoin = sql`
        join locations l on l.id = p.primary_location_id
          and l.deleted_at is null
        join funding_accounts fa on fa.id = l.funding_account_id
          and fa.deleted_at is null
        join department_id_blocks b on b.id = fa.department_id_block_id
      `;
    }

    let nextId: string;
    try {
      const { rows } = await this.drizzle.client.execute<{ nextId: string }>(
        sql`
          with block_range as (
            select b.range
            from projects p
            ${blockRangeJoin}
            where p.id = ${projectId}
          ),
          enumerated as (
            select
              id,
              case
                when id < 10000 then lpad(id::text, 5, '0')
                else id::text
              end as dept_id
            from block_range,
                 unnest(block_range.range) as r,
                 lateral generate_series(lower(r), upper(r) - 1) as id
          ),
          used as (
            select department_id from projects
            where department_id is not null and deleted_at is null
            -- An ID Intacct already holds is as unavailable as one a project
            -- already has. Dropping this arm is silent — CORD cannot see an Intacct collision, and the unique
            -- index on projects.department_id will not catch one either.
            union
            select department_id from external_department_ids
          )
          select dept_id as "nextId" from enumerated
          where dept_id not in (select department_id from used)
          order by id asc
          limit 1
        `,
      );
      const first = rows[0];
      if (!first) {
        throw new ServerException('No department ID is available');
      }
      nextId = first.nextId;
    } catch (e) {
      if (e instanceof ServerException) throw e;
      throw new ServerException(
        'Could not resolve next available department ID',
        e,
      );
    }

    try {
      await this.drizzle.client
        .update(projects)
        .set({ departmentId: nextId, modifiedAt: new Date() })
        .where(eq(projects.id, projectId));
      return nextId;
    } catch (e) {
      if (isUniqueViolation(e, 'projects_department_id_active_unique')) {
        // Signal the transaction interceptor to retry. A concurrent assignment grabbed the same id between our
        // SELECT and UPDATE; reading + writing again will pick the next one.
        this.retryInformer.markForRetry(e as Error);
        throw new ServerException(
          "Could not set Project's Department ID (retryable)",
          e,
        );
      }
      throw new ServerException("Could not set Project's Department ID", e);
    }
  }
}
