import { Injectable } from '@nestjs/common';
import { isNull, node, not, relation } from 'cypher-query-builder';
import { eq, sql } from 'drizzle-orm';
import {
  ClientException,
  type ID,
  NotImplementedException,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ConfigService } from '~/core/config';
import { TransactionRetryInformer } from '~/core/database';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { PgErrorCode } from '~/core/drizzle/pg-error-codes';
import { projects } from '~/core/drizzle/schema';
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
   * PG path — resolves the DepartmentIdBlock via the FK chain
   * `project.primary_location_id → locations.funding_account_id →
   * funding_accounts.department_id_block_id`, enumerates the block's
   * `range int4multirange`, picks the smallest 5-digit-padded id that
   * isn't already used, and UPDATEs `projects.department_id`. Catches PG
   * unique violation 23505 on the partial-unique index and marks the
   * transaction for retry — mirror of the Neo4j UniquenessError flow.
   *
   * MultiplicationTranslation projects route via partnership → partner
   * instead, but `partnerships` isn't migrated — throws NotImplementedException
   * with a clear message until partnership-pg lands.
   *
   * `funding_accounts` lives on develop (PR #9) but isn't on this branch's
   * base (`partner-pg` predates the funding-account merge). Raw SQL references
   * the table by name so the handler compiles here and Just Works at runtime
   * once this stack rebases onto develop. Same approach as the deferred-FK
   * pattern used elsewhere.
   *
   * `external_department_ids` exclusion is dropped — that table is part of an
   * unmigrated domain. migration-todo: re-add the exclusion when that domain
   * ports (probably with the broader Finance/Admin work).
   */
  private async assignDepartmentIdPg(project: UnsecuredDto<Project>) {
    if (project.type === 'MultiplicationTranslation') {
      // migration-todo: implement the partnership → partner → block path
      // when partnership-pg lands. Until then this branch never fires in
      // production (DATABASE=postgres is dev-only), but it'd surface as a
      // failed transition if hit. Mirror of the Neo4j repo's `holder` switch.
      throw new NotImplementedException(
        'SetDepartmentId for MultiplicationTranslation projects requires Partnership migration — pending.',
      );
    }
    if (!project.primaryLocation) {
      throw new ClientException(
        'Project must have a primary location to continue',
      );
    }

    const projectId = project.id;
    let nextId: string;
    try {
      const { rows } = await this.drizzle.client.execute<{ nextId: string }>(
        sql`
          with block_range as (
            select b.range
            from projects p
            join locations l on l.id = p.primary_location_id
            join funding_accounts fa on fa.id = l.funding_account_id
            join department_id_blocks b on b.id = fa.department_id_block_id
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
      const code = (e as { code?: string })?.code;
      const constraint = (e as { constraint?: string })?.constraint;
      if (
        code === PgErrorCode.UniqueViolation &&
        constraint === 'projects_department_id_active_unique'
      ) {
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
