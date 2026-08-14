import { Injectable } from '@nestjs/common';
import { isNull, node, not, relation } from 'cypher-query-builder';
import { and, eq, isNull as isNullColumn, sql } from 'drizzle-orm';
import {
  ClientException,
  type ID,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ConfigService } from '~/core/config';
import { TransactionRetryInformer } from '~/core/database';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { isUniqueViolation } from '~/core/drizzle/errors';
import { partners, partnerships, projects } from '~/core/drizzle/schema';
import { OnHook } from '~/core/hooks';
import { DatabaseService, UniquenessError } from '~/core/neo4j';
import {
  ACTIVE,
  apoc,
  collect,
  updateProperty,
  variable,
} from '~/core/neo4j/query';
import {
  type Project,
  resolveProjectType,
  ProjectStatus as Status,
  ProjectStep as Step,
} from '../dto';
import { ProjectUpdatedHook } from '../hooks';
import { ProjectTransitionedHook } from '../workflow/hooks/project-transitioned.hook';

@Injectable()
export class SetDepartmentId {
  constructor(
    private readonly db: DatabaseService,
    private readonly drizzle: DrizzleService,
    private readonly config: ConfigService,
    private readonly retryInformer: TransactionRetryInformer,
  ) {}

  @OnHook(ProjectTransitionedHook)
  @OnHook(ProjectUpdatedHook)
  async handle(event: ProjectTransitionedHook | ProjectUpdatedHook) {
    // migration-todo: collapse the gel-early-return at Phase 7 cutover when
    // the Gel path is removed.
    if (this.config.databaseEngine === 'gel') {
      return;
    }

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

    // migration-todo: collapse this engine-check at Phase 7 cutover — drop
    // the Neo4j branch + assignDepartmentIdNeo4j + DatabaseService injection,
    // keep only the PG path.
    const departmentId =
      this.config.databaseEngine === 'postgres'
        ? await this.assignDepartmentIdPg(project)
        : await this.assignDepartmentIdNeo4j(project);

    const changed = { ...project, departmentId };
    if (event instanceof ProjectTransitionedHook) {
      event.project = changed;
    } else {
      event.updated = changed;
    }
  }

  private async assignDepartmentIdNeo4j(project: UnsecuredDto<Project>) {
    const block = await this.getDepartmentIdBlockId(project);
    return await this.assignDepartmentIdForProject(project, block);
  }

  /**
   * PG path — resolves the DepartmentIdBlock via one of two FK chains,
   * enumerates the block's `range int4multirange`, picks the smallest
   * 5-digit-padded id that isn't already used, and UPDATEs
   * `projects.department_id`. Catches PG unique violation 23505 on the
   * partial-unique index and marks the transaction for retry — mirror of
   * the Neo4j UniquenessError flow.
   *
   * MultiplicationTranslation projects route via
   * `partnerships (primary) → partners.department_id_block_id`; everything
   * else via `project.primary_location_id → locations.funding_account_id →
   * funding_accounts.department_id_block_id`. `project.primaryPartnership`
   * is a hard-coded null stub on the Postgres hydrate (unlike
   * `primaryLocation`, which is real) — mirroring Neo4j's
   * `!project.primaryPartnership` precondition check would false-positive
   * for every Multiplication project. The primary-partnership branch below
   * queries `partnerships`/`partners` directly instead.
   *
   * `funding_accounts` / `department_id_blocks` / `locations` / `partnerships` /
   * `partners` are all present on the recut base, so both FK chains resolve.
   * Raw SQL is used for the enumeration itself — `unnest(range)` + `lateral
   * generate_series` over the `int4multirange` don't have a clean
   * query-builder form.
   *
   * `external_department_ids` exclusion is dropped — that table is part of an
   * unmigrated domain. migration-todo: re-add the exclusion when that domain
   * ports (probably with the broader Finance/Admin work).
   */
  private async assignDepartmentIdPg(project: UnsecuredDto<Project>) {
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
            select case
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
            -- migration-todo: also exclude external_department_ids when that
            -- table migrates (likely Admin domain).
          )
          select dept_id as "nextId" from enumerated
          where dept_id not in (select department_id from used)
          order by dept_id asc
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
        // Mirror of the Neo4j path: signal the transaction interceptor to
        // retry. A concurrent assignment grabbed the same id between our
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

  private async assignDepartmentIdForProject(
    project: UnsecuredDto<Project>,
    block: { id: ID },
  ) {
    const query = this.db
      .query()
      // Enumerate IDs from the department ID block
      .subQuery((sub) =>
        sub
          .match(node('block', 'DepartmentIdBlock', { id: block.id }))
          .with(apoc.convert.fromJsonList('block.blocks').as('blocks'))
          // enumerate all ranges
          .with(
            apoc.coll
              .flatten(['block in blocks | range(block.start, block.end)'])
              .as('ids'),
          )
          // convert numbers to strings and pad to 5 digits with leading zeros
          .with(
            `[id in ids |
              case
                when id < 10000 then
                  apoc.text.lpad(toString(id), 5, "0")
                else toString(id)
              end
            ] as ids`,
          )
          .return('ids as enumerated'),
      )
      // Get used IDs
      .subQuery((sub) =>
        sub
          .subQuery((sub2) =>
            sub2
              .match([
                node('', 'Project'),
                relation('out', '', 'departmentId', ACTIVE),
                node('deptIdNode', 'Property'),
              ])
              .where({ 'deptIdNode.value': not(isNull()) })
              .return('deptIdNode.value as id')
              .union()
              .match(node('external', 'ExternalDepartmentId'))
              .return('external.departmentId as id'),
          )
          .return(collect('id').as('used')),
      )
      // Distill to available
      .with('[id in enumerated where not id in used][0] as next')
      // collapse cardinality to zero if none available
      .raw('unwind next as nextId')

      .match(node('node', 'Project', { id: project.id }))
      .apply(
        updateProperty({
          resource: resolveProjectType(project),
          key: 'departmentId',
          value: variable('nextId'),
        }),
      )
      .return<{ departmentId: string }>('nextId as departmentId, stats');
    let res;
    try {
      res = await query.first();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'DepartmentId') {
        this.retryInformer.markForRetry(e);
      }
      throw new ServerException("Could not set Project's Department ID", e);
    }
    if (!res) {
      throw new ServerException('No department ID is available');
    }
    return res.departmentId;
  }

  private async getDepartmentIdBlockId(project: UnsecuredDto<Project>) {
    const isMultiplication = project.type === 'MultiplicationTranslation';
    if (isMultiplication) {
      if (!project.primaryPartnership) {
        throw new ClientException(
          'Project must have a partnership to continue',
        );
      }
    } else if (!project.primaryLocation) {
      throw new ClientException(
        'Project must have a primary location to continue',
      );
    }

    const block = await this.db
      .query()
      .match(node('project', 'Project', { id: project.id }))
      .match(
        isMultiplication
          ? [
              [
                node('project'),
                relation('out', '', 'partnership', ACTIVE),
                node('partnership', 'Partnership'),
                relation('out', '', 'primary', ACTIVE),
                node('', 'Property', { value: variable('true') }),
              ],
              [node('partnership'), relation('out'), node('holder', 'Partner')],
            ]
          : [
              node('project'),
              relation('out', '', 'primaryLocation', ACTIVE),
              node('', 'Location'),
              relation('out', '', 'fundingAccount', ACTIVE),
              node('holder', 'FundingAccount'),
            ],
      )
      .match([
        node('holder'),
        relation('out'),
        node('block', 'DepartmentIdBlock'),
      ])
      .return<{ id: ID }>('block.id as id')
      .first();
    if (block) {
      return block;
    }
    if (isMultiplication) {
      throw new ClientException(
        "Project's primary partner does not have a department ID blocks declared",
      );
    }
    throw new ServerException(
      `Unable to find accountNumber associated with project: ${project.id}`,
    );
  }
}
