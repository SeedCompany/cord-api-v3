import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, max } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import { DrizzleDtoRepository } from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { budgetLineItems } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  BudgetLineItem,
  type CreateBudgetLineItem,
  type UpdateBudgetLineItem,
} from './dto';

type BudgetLineItemRow = typeof budgetLineItems.$inferSelect & {
  budget?: { id: ID<'Budget'>; project?: { id: ID<'Project'> } | null } | null;
};

/**
 * New resource — no Neo4j/Gel counterpart, so this is a single, direct
 * Drizzle repository (no `splitDb(...)` pair). See `budget-reference-country.
 * repository.ts` for the same reasoning.
 */
@Injectable()
export class BudgetLineItemRepository extends DrizzleDtoRepository<
  typeof budgetLineItems,
  BudgetLineItem
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(db, budgetLineItems, BudgetLineItem);
  }

  async create(input: CreateBudgetLineItem): Promise<ID> {
    const id = await generateId<ID<'BudgetLineItem'>>();
    const position = await this.nextPosition(input.budget);
    await this.db.insert(budgetLineItems).values({
      id,
      budgetId: input.budget,
      type: input.type ?? 'line',
      position,
      account: input.account ?? null,
      description: input.description ?? null,
      costType: input.costType ?? 'Cash',
      budgetCategory: input.budgetCategory ?? 'Field Budget',
      activity: input.activity ?? null,
      serviceProviderOrgId: input.serviceProvider ?? null,
      funderOrgId: input.funder ?? null,
      fiscalYearAmounts: input.fiscalYearAmounts ?? {},
    });
    return id;
  }

  /**
   * Current-max-plus-one ordering position for a new row in this budget —
   * never accepted from the client (see `CreateBudgetLineItem`), assigned
   * here to keep it a real, server-maintained ordered list.
   */
  private async nextPosition(budgetId: ID<'Budget'>): Promise<number> {
    const [row] = await this.db
      .select({ max: max(budgetLineItems.position) })
      .from(budgetLineItems)
      .where(
        and(
          eq(budgetLineItems.budgetId, budgetId),
          isNull(budgetLineItems.deletedAt),
        ),
      );
    return (row?.max ?? 0) + 1;
  }

  async update(
    id: ID,
    changes: ChangesOf<BudgetLineItem, UpdateBudgetLineItem>,
  ): Promise<void> {
    await this.updateColumns(id, {
      type: changes.type,
      account: changes.account,
      description: changes.description,
      costType: changes.costType,
      budgetCategory: changes.budgetCategory,
      activity: changes.activity,
      serviceProviderOrgId: changes.serviceProvider,
      funderOrgId: changes.funder,
      fiscalYearAmounts: changes.fiscalYearAmounts,
    });
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<BudgetLineItem>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.budgetLineItems.findMany({
      where: (li) => and(inArray(li.id, [...ids]), isNull(li.deletedAt)),
      with: {
        budget: {
          columns: { id: true },
          with: { project: { columns: { id: true } } },
        },
      },
    });
    return await this.mapRows(rows as BudgetLineItemRow[]);
  }

  /** All live line items of a budget — drives `Budget.lineItems`. */
  async listByBudget(
    budgetId: ID<'Budget'>,
  ): Promise<Array<UnsecuredDto<BudgetLineItem>>> {
    const rows = await this.db.query.budgetLineItems.findMany({
      where: (li) => and(eq(li.budgetId, budgetId), isNull(li.deletedAt)),
      with: {
        budget: {
          columns: { id: true },
          with: { project: { columns: { id: true } } },
        },
      },
      orderBy: (li, { asc }) => [asc(li.position), asc(li.id)],
    });
    return await this.mapRows(rows as BudgetLineItemRow[]);
  }

  async getBudgetId(id: ID): Promise<ID<'Budget'>> {
    const row = await this.db.query.budgetLineItems.findFirst({
      where: (li) => eq(li.id, id),
      columns: { budgetId: true },
    });
    if (!row) {
      throw new NotFoundException('Could not find BudgetLineItem');
    }
    return row.budgetId;
  }

  private async mapRows(rows: BudgetLineItemRow[]) {
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
    row: BudgetLineItemRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<BudgetLineItem> {
    const dto: unknown = {
      id: row.id,
      __typename: 'BudgetLineItem',
      createdAt: DateTime.fromJSDate(row.createdAt),
      type: row.type,
      position: row.position,
      account: row.account,
      description: row.description,
      costType: row.costType,
      budgetCategory: row.budgetCategory,
      activity: row.activity,
      serviceProvider: row.serviceProviderOrgId,
      funder: row.funderOrgId,
      fiscalYearAmounts: row.fiscalYearAmounts,
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<BudgetLineItem>;
  }
}
