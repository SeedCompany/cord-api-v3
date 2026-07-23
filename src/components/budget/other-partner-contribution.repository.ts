import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
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
import { otherPartnerContributions } from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  type CreateOtherPartnerContribution,
  OtherPartnerContribution,
  type UpdateOtherPartnerContribution,
} from './dto';

type OtherPartnerContributionRow =
  typeof otherPartnerContributions.$inferSelect & {
    budget?: {
      id: ID<'Budget'>;
      project?: { id: ID<'Project'> } | null;
    } | null;
  };

/**
 * New resource — no Neo4j/Gel counterpart, so this is a single, direct
 * Drizzle repository (no `splitDb(...)` pair). See `budget-reference-country.
 * repository.ts` for the same reasoning.
 */
@Injectable()
export class OtherPartnerContributionRepository extends DrizzleDtoRepository<
  typeof otherPartnerContributions,
  OtherPartnerContribution
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(db, otherPartnerContributions, OtherPartnerContribution);
  }

  async create(input: CreateOtherPartnerContribution): Promise<ID> {
    const id = await generateId<ID<'OtherPartnerContribution'>>();
    await this.db.insert(otherPartnerContributions).values({
      id,
      budgetId: input.budget,
      donorOrgId: input.donor ?? null,
      description: input.description ?? null,
      fiscalYearAmounts: input.fiscalYearAmounts ?? {},
    });
    return id;
  }

  async update(
    id: ID,
    changes: ChangesOf<
      OtherPartnerContribution,
      UpdateOtherPartnerContribution
    >,
  ): Promise<void> {
    await this.updateColumns(id, {
      donorOrgId: changes.donor,
      description: changes.description,
      fiscalYearAmounts: changes.fiscalYearAmounts,
    });
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  override async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<OtherPartnerContribution>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.otherPartnerContributions.findMany({
      where: (opc) => and(inArray(opc.id, [...ids]), isNull(opc.deletedAt)),
      with: {
        budget: {
          columns: { id: true },
          with: { project: { columns: { id: true } } },
        },
      },
    });
    return await this.mapRows(rows as OtherPartnerContributionRow[]);
  }

  /** All live rows of a budget — drives `Budget.otherPartnerContributions`. */
  async listByBudget(
    budgetId: ID<'Budget'>,
  ): Promise<Array<UnsecuredDto<OtherPartnerContribution>>> {
    const rows = await this.db.query.otherPartnerContributions.findMany({
      where: (opc) => and(eq(opc.budgetId, budgetId), isNull(opc.deletedAt)),
      with: {
        budget: {
          columns: { id: true },
          with: { project: { columns: { id: true } } },
        },
      },
      orderBy: (opc, { asc }) => [asc(opc.createdAt), asc(opc.id)],
    });
    return await this.mapRows(rows as OtherPartnerContributionRow[]);
  }

  async getBudgetId(id: ID): Promise<ID<'Budget'>> {
    const row = await this.db.query.otherPartnerContributions.findFirst({
      where: (opc) => eq(opc.id, id),
      columns: { budgetId: true },
    });
    if (!row) {
      throw new NotFoundException('Could not find OtherPartnerContribution');
    }
    return row.budgetId;
  }

  private async mapRows(rows: OtherPartnerContributionRow[]) {
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
    row: OtherPartnerContributionRow,
    scope: ScopedRole[] = [],
  ): UnsecuredDto<OtherPartnerContribution> {
    const dto: unknown = {
      id: row.id,
      __typename: 'OtherPartnerContribution',
      createdAt: DateTime.fromJSDate(row.createdAt),
      donor: row.donorOrgId,
      description: row.description,
      fiscalYearAmounts: row.fiscalYearAmounts,
      canDelete: true,
      scope,
    };
    return dto as UnsecuredDto<OtherPartnerContribution>;
  }
}
