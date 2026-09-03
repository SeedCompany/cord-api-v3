import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type ObjectView,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import {
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { budgets, type projects } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { type FileId } from '../file/dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import { type BudgetRecordDrizzleRepository } from './budget-record.drizzle.repository';
import { BudgetRecordRepository } from './budget-record.repository';
import {
  Budget,
  type BudgetListInput,
  type CreateBudget,
  type UpdateBudget,
} from './dto';

type BudgetRow = typeof budgets.$inferSelect & {
  project?: Pick<
    typeof projects.$inferSelect,
    'id' | 'sensitivity' | 'type'
  > | null;
};

@Injectable()
export class BudgetDrizzleRepository extends DrizzleDtoRepository<
  typeof budgets,
  Budget
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
    private readonly identity: Identity,
    // Resolves to the Drizzle implementation under DATABASE=postgres, which
    // is the only engine this repository is instantiated for.
    @Inject(BudgetRecordRepository)
    private readonly records: BudgetRecordDrizzleRepository,
  ) {
    super(db, budgets, Budget);
  }

  async create(
    input: CreateBudget,
    universalTemplateFileId: FileId,
  ): Promise<ID> {
    // The defined-file node is created by the service (createDefinedFile); we
    // store the FK link here.
    const id = await generateId<ID<'Budget'>>();
    await this.db.insert(budgets).values({
      id,
      projectId: input.project,
      status: 'Pending',
      universalTemplateFileId,
    });
    return id;
  }

  async update(
    existing: Budget,
    simpleChanges: Omit<
      ChangesOf<Budget, UpdateBudget>,
      'universalTemplateFile'
    >,
  ) {
    await this.updateColumns(existing.id, {
      status: simpleChanges.status,
    });
    return { ...existing, ...simpleChanges };
  }

  override async readMany(
    ids: readonly ID[],
    _view?: ObjectView,
  ): Promise<Array<UnsecuredDto<Budget>>> {
    // View param accepted for splitDb signature parity; PCR/Changeset is
    // excluded from the migration, so it collapses to the canonical row.
    if (ids.length === 0) return [];
    const rows = await this.db.query.budgets.findMany({
      where: (b) => and(inArray(b.id, [...ids]), isNull(b.deletedAt)),
      with: {
        // `type` feeds the parent ref's __typename (`${type}Project`).
        project: { columns: { id: true, sensitivity: true, type: true } },
      },
    });
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((r) => r.projectId),
    );
    return (rows as BudgetRow[]).map((row) =>
      this.toDto(row, scopeByProject.get(row.projectId) ?? []),
    );
  }

  async list({ filter, ...input }: BudgetListInput) {
    const conditions: SQL[] = [isNull(budgets.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }
    if (filter?.projectId) {
      conditions.push(eq(budgets.projectId, filter.projectId));
    }
    return await this.listIds(conditions, input);
  }

  async listUnsecure({ filter, ...input }: BudgetListInput) {
    const conditions: SQL[] = [isNull(budgets.deletedAt)];
    if (filter?.projectId) {
      conditions.push(eq(budgets.projectId, filter.projectId));
    }
    return await this.listIds(conditions, input);
  }

  /**
   * Both list flavors return bare IDs — the service hydrates each via
   * `readOne` (mirror of the Neo4j `paginate()`-without-hydrate flow).
   */
  private async listIds(
    conditions: SQL[],
    input: Omit<BudgetListInput, 'filter'>,
  ) {
    const sortColumns = {
      status: budgets.status,
      createdAt: budgets.createdAt,
    } satisfies SortMap<keyof Budget>;
    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, budgets.createdAt),
      page: input.page,
      count: input.count,
    });
    return { items: rows.map((r) => r.id), total, hasMore };
  }

  async listRecordsForSync(projectId: ID, _changeset?: ID) {
    // Rank Current first, then Pending, then anything else — mirror of the
    // Neo4j currentBudgetForProject ranking. PCR is excluded, so the
    // changeset-pending override collapses away.
    const [budget] = await this.db
      .select({ id: budgets.id, status: budgets.status })
      .from(budgets)
      .where(and(eq(budgets.projectId, projectId), isNull(budgets.deletedAt)))
      .orderBy(
        sql`case ${budgets.status}
          when 'Current' then 0
          when 'Pending' then 1
          else 100
        end`,
      )
      .limit(1);
    if (!budget) {
      throw new NotFoundException("Could not find project's budget");
    }
    const records = await this.records.readManyByBudget(budget.id);
    return { id: budget.id, status: budget.status, records };
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  protected toDto(
    row: BudgetRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<Budget> {
    if (!row.project) {
      throw new Error(
        `Budget ${row.id} has no parent project row — FK invariant violated`,
      );
    }
    // Not laundered through `unknown` before the cast below: that stops
    // TypeScript comparing this object to the DTO at all, which is how a field
    // can go missing or take the wrong shape unnoticed. The direct cast still
    // allows the service-layer overlays (canDelete, scope) and the fields the
    // service fills in later.
    const dto = {
      id: row.id,
      __typename: 'Budget',
      createdAt: DateTime.fromJSDate(row.createdAt),
      status: row.status,
      sensitivity: row.project.sensitivity,
      // The bare id, matching both the Neo4j repo and the declared DefinedFile
      // type. The resolver accepts a null here and yields no file.
      universalTemplateFile: row.universalTemplateFileId,
      // Assembled by the service via listRecords.
      records: [],
      parent: {
        id: row.project.id,
        __typename: `${row.project.type}Project`,
      },
      // PCR is excluded; resolver navigation marker stays undefined.
      changeset: undefined,
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<Budget>;
  }
}
