import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
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
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { budgetRecords } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  type Budget,
  BudgetRecord,
  type BudgetRecordListInput,
  type CreateBudgetRecord,
  type UpdateBudgetRecord,
} from './dto';

type BudgetRecordRow = typeof budgetRecords.$inferSelect & {
  budget?: {
    id: ID<'Budget'>;
    status: string;
    project?: { id: ID<'Project'>; sensitivity: string } | null;
  } | null;
};

@Injectable()
export class BudgetRecordDrizzleRepository extends DrizzleDtoRepository<
  typeof budgetRecords,
  BudgetRecord
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(db, budgetRecords, BudgetRecord);
  }

  async create(input: CreateBudgetRecord, _changeset?: ID): Promise<ID> {
    // Changeset accepted for splitDb signature parity; PCR is excluded.
    const id = await generateId<ID<'BudgetRecord'>>();
    await this.db.insert(budgetRecords).values({
      id,
      budgetId: input.budget,
      organizationId: input.organization,
      fiscalYear: input.fiscalYear,
      amount: null,
      initialAmount: null,
      preApprovedAmount: null,
    });
    return id;
  }

  async update(
    existing: UnsecuredDto<BudgetRecord>,
    changes: ChangesOf<Budget, UpdateBudgetRecord>,
    _changeset?: ID,
  ) {
    await this.updateColumns(existing.id, {
      amount: changes.amount,
      initialAmount: changes.initialAmount,
      preApprovedAmount: changes.preApprovedAmount,
    });
    return { ...existing, ...changes };
  }

  async doesRecordExist(input: CreateBudgetRecord): Promise<boolean> {
    const [row] = await this.db
      .select({ id: budgetRecords.id })
      .from(budgetRecords)
      .where(
        and(
          eq(budgetRecords.budgetId, input.budget),
          eq(budgetRecords.organizationId, input.organization),
          eq(budgetRecords.fiscalYear, input.fiscalYear),
          isNull(budgetRecords.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  override async readOne(
    id: ID,
    _opts?: { view?: ObjectView },
  ): Promise<UnsecuredDto<BudgetRecord>> {
    const [dto] = await this.readMany([id]);
    if (!dto) {
      throw new NotFoundException('Could not find BudgetRecord', 'budget');
    }
    return dto;
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<BudgetRecord>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.budgetRecords.findMany({
      where: (br) => and(inArray(br.id, [...ids]), isNull(br.deletedAt)),
      with: {
        budget: {
          columns: { id: true, status: true },
          with: { project: { columns: { id: true, sensitivity: true } } },
        },
      },
    });
    return await this.mapRows(rows as BudgetRecordRow[]);
  }

  /** All live records of a budget — drives the budget-record sync handler. */
  async readManyByBudget(
    budgetId: ID<'Budget'>,
  ): Promise<Array<UnsecuredDto<BudgetRecord>>> {
    const rows = await this.db.query.budgetRecords.findMany({
      where: (br) => and(eq(br.budgetId, budgetId), isNull(br.deletedAt)),
      with: {
        budget: {
          columns: { id: true, status: true },
          with: { project: { columns: { id: true, sensitivity: true } } },
        },
      },
    });
    return await this.mapRows(rows as BudgetRecordRow[]);
  }

  async list(input: BudgetRecordListInput, _view?: ObjectView) {
    const conditions: SQL[] = [isNull(budgetRecords.deletedAt)];
    if (input.filter?.budgetId) {
      conditions.push(eq(budgetRecords.budgetId, input.filter.budgetId));
    }
    const sortColumns = {
      fiscalYear: budgetRecords.fiscalYear,
      amount: budgetRecords.amount,
      createdAt: budgetRecords.createdAt,
    } satisfies SortMap<keyof BudgetRecord>;
    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, budgetRecords.fiscalYear),
      page: input.page,
      count: input.count,
    });
    // Bare IDs — the service hydrates each via readOneRecord (mirror of the
    // Neo4j paginate()-without-hydrate flow).
    return { items: rows.map((r) => r.id), total, hasMore };
  }

  async delete(id: ID, _changeset?: ID): Promise<void> {
    await this.softDelete(id);
  }

  private async mapRows(rows: BudgetRecordRow[]) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.flatMap((r) => r.budget?.project?.id ?? []),
    );
    return rows.map((row) =>
      this.toDto(
        row,
        row.budget?.project
          ? (scopeByProject.get(row.budget.project.id) ?? [])
          : [],
      ),
    );
  }

  protected toDto(
    row: BudgetRecordRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<BudgetRecord> {
    if (!row.budget?.project) {
      throw new Error(
        `BudgetRecord ${row.id} has no parent budget/project row — FK invariant violated`,
      );
    }
    const dto: unknown = {
      id: row.id,
      __typename: 'BudgetRecord',
      createdAt: DateTime.fromJSDate(row.createdAt),
      organization: row.organizationId,
      fiscalYear: row.fiscalYear,
      amount: row.amount,
      initialAmount: row.initialAmount,
      preApprovedAmount: row.preApprovedAmount,
      status: row.budget.status,
      sensitivity: row.budget.project.sensitivity,
      parent: { id: row.budget.id, __typename: 'Budget' },
      // PCR is excluded; resolver navigation marker stays undefined.
      changeset: undefined,
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<BudgetRecord>;
  }
}
