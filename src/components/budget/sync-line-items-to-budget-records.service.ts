import { Inject, Injectable } from '@nestjs/common';
import { type ID, type UnsecuredDto } from '~/common';
import { isUniqueViolation } from '~/core/drizzle/errors';
import { BudgetLineItemRepository } from './budget-line-item.repository';
import { BudgetRecordDrizzleRepository } from './budget-record.drizzle.repository';
import { BudgetRecordRepository } from './budget-record.repository';
import { type BudgetRecord, BudgetStatus } from './dto';

const recordKey = (organizationId: ID, fiscalYear: number): string =>
  `${organizationId}:${fiscalYear}`;

/**
 * Syncs `budget_records.amount` FROM the budget-line-items-poc line items
 * (phase 3) — "existing project budgets per partner per FY should be
 * populated from the data in this budget details." A NEW, separate
 * mechanism from `handlers/sync-budget-records-to-funding-partners.handler.ts`
 * (read that file in full before touching this one) — that existing handler
 * only ever creates/removes `BudgetRecord` ROWS from Partnership fiscal
 * years; it never touches `amount`. This service is the first thing that
 * writes `amount` from anywhere other than a direct `updateRecord` edit.
 *
 * DESIGN DECISIONS (flagged prominently — this is a real, disclosed
 * behavior change, not a silent side effect):
 *
 * 1. **`amount` becomes computed-from-line-items** for any (organization,
 *    fiscal year) that has at least one `BudgetLineItem` with that org as
 *    its EXPLICIT `funder` — for those rows, a user editing line items now
 *    indirectly overwrites whatever was hand-entered in `BudgetRecord.amount`
 *    for that org+FY, rather than `amount` being purely hand-edited via
 *    `updateBudgetRecord`. Organizations/fiscal-years with no explicit
 *    -funder line items are untouched by this sync (their `amount` stays
 *    exactly whatever `updateBudgetRecord` last set).
 *
 * 2. **Lines with no explicit `funder`** (which default to the budget's
 *    primary funder — see `BudgetCalculationService.computeBudget`'s
 *    `?? config.primaryFunderId` fallback) are NOT attributed to any
 *    specific organization's `BudgetRecord` here. `Project.primaryPartnership`
 *    is stubbed to `null` under the Postgres/Drizzle path today (see
 *    `project.drizzle.repository.ts` and the same gap noted in
 *    `BudgetResolver.calculationSummary`), so there is no reliable
 *    organization id to attribute the primary funder's own lines to. This is
 *    a disclosed, pre-existing, out-of-scope gap — NOT worked around here.
 *
 * 3. **Cash and In-Kind both count** toward the summed funding total —
 *    matches how `BudgetCalculationService.computeBudget` treats "allCost"
 *    (both cost types feed it; only the `ADMIN_FEE_ACCOUNT` row is excluded,
 *    and that account is never expected to carry an explicit `funder` in
 *    practice, so it's not special-cased here).
 *
 * 4. **Only `amount` is ever written** — `initialAmount`/`preApprovedAmount`
 *    are separately-tracked approval-stage snapshots (see
 *    `BudgetService.updateRecord`'s doc comment / lockstep logic) and are
 *    never touched here, EXCEPT that this service reproduces
 *    `updateRecord`'s own "auto-sync `initialAmount` with `amount` while
 *    the record is `Pending` and the two were already equal" behavior, to
 *    preserve that existing rule rather than silently breaking it for
 *    records this sync happens to touch.
 *
 * 5. **Row creation reuses `BudgetRecordDrizzleRepository.create()`** (the
 *    same low-level insert `BudgetService.createRecord()` itself calls) —
 *    not a second, independently-written insert — specifically so this and
 *    the Partnership-based sync can't drift into two different creation
 *    code paths. A `DuplicateException`-shaped unique-constraint race
 *    against that OTHER sync (both could legitimately want a row for the
 *    same org+FY) is caught and resolved by re-reading the now-existing row,
 *    rather than failing the whole sync.
 *
 * 6. **Runs as a direct call from `BudgetLineItemService`/
 *    `OtherPartnerContributionService`** (create/update/delete), not a Hook
 *    handler — this bypasses `BudgetService.updateRecord()`'s privilege
 *    check on `BudgetRecord.amount` entirely (it talks to
 *    `BudgetRecordDrizzleRepository` directly, which — like all repositories
 *    in this codebase — does no authorization of its own). That's a
 *    deliberate choice: the derived amount is treated as a side effect of an
 *    action the user was ALREADY authorized to take on the `BudgetLineItem`
 *    itself, not a second, separately-authorizable action on `BudgetRecord`.
 *    Flagged here as a design decision worth revisiting if a role can edit
 *    line items but not `BudgetRecord.amount` (no such role split exists in
 *    today's policies, per a check of `src/components/authorization/policies
 *    /by-role/*.ts` — every role granted `Budget.edit`/`r.Budget.read.when
 *    (member).edit` also gets the same for `BudgetRecord`).
 *
 * `OtherPartnerContribution` mutations also call `syncForBudget()` (see
 * `OtherPartnerContributionService`), per the task's explicit "after each
 * BudgetLineItem/OtherPartnerContribution create/update/delete" — even
 * though, as currently scoped, OPC rows never enter the sum above (only
 * `BudgetLineItem.funder` does), so today those calls are a no-op. Wired
 * anyway so a future extension of the algorithm to also attribute OPC's
 * `donor` doesn't need a second look for where to add the trigger.
 *
 * 7. **KNOWN GAP, found by hand-testing this end-to-end**: if an
 *    organization's LAST explicit-funder line item is deleted (or its
 *    funder is changed away from that org), that organization drops out of
 *    `sums` entirely, and this method does NOT zero out / delete its
 *    now-stale `budget_records.amount` for the fiscal years it used to
 *    cover — the last-synced figure just lingers untouched. Deliberately
 *    NOT "fixed" by zeroing any (org, FY) `BudgetRecord` missing from
 *    `sums`: that would also zero out records for organizations that were
 *    NEVER derived from line items at all (e.g. hand-entered via
 *    `updateBudgetRecord` for an org with no line items), which would be a
 *    much bigger, riskier behavior change than anything asked for here —
 *    there's no column on `budget_records` today distinguishing
 *    "line-item-derived" from "hand-entered" amounts to scope a safer fix
 *    to. Flagged here, not silently left as a surprise.
 */
@Injectable()
export class SyncLineItemsToBudgetRecordsService {
  constructor(
    private readonly lineItems: BudgetLineItemRepository,
    // Resolves to the Drizzle implementation under DATABASE=postgres, which
    // is the only engine this service is ever exercised under — same
    // `@Inject(BudgetRecordRepository)` + concrete-type pattern
    // `BudgetDrizzleRepository` already uses for its own `records` field.
    @Inject(BudgetRecordRepository)
    private readonly budgetRecords: BudgetRecordDrizzleRepository,
  ) {}

  async syncForBudget(budgetId: ID<'Budget'>): Promise<void> {
    const lines = await this.lineItems.listByBudget(budgetId);

    const sums = new Map<ID<'Organization'>, Map<number, number>>();
    for (const line of lines) {
      if (line.type === 'header') {
        continue;
      }
      const funderId = line.funder;
      if (!funderId) {
        // No explicit funder — see design decision #2 above.
        continue;
      }
      const perFy = sums.get(funderId) ?? new Map<number, number>();
      for (const [fiscalYearKey, amount] of Object.entries(
        line.fiscalYearAmounts ?? {},
      )) {
        const fiscalYear = Number(fiscalYearKey);
        if (!Number.isFinite(fiscalYear)) {
          continue;
        }
        perFy.set(fiscalYear, (perFy.get(fiscalYear) ?? 0) + (amount ?? 0));
      }
      sums.set(funderId, perFy);
    }

    if (sums.size === 0) {
      return;
    }

    const existingRows = await this.budgetRecords.readManyByBudget(budgetId);
    const existingByKey = new Map(
      existingRows.map((row) => [
        recordKey(row.organization, row.fiscalYear),
        row,
      ]),
    );

    for (const [organizationId, perFy] of sums) {
      for (const [fiscalYear, amount] of perFy) {
        await this.upsertAmount(
          budgetId,
          organizationId,
          fiscalYear,
          amount,
          existingByKey,
        );
      }
    }
  }

  private async upsertAmount(
    budgetId: ID<'Budget'>,
    organizationId: ID<'Organization'>,
    fiscalYear: number,
    amount: number,
    existingByKey: Map<string, UnsecuredDto<BudgetRecord>>,
  ): Promise<void> {
    const key = recordKey(organizationId, fiscalYear);
    let record = existingByKey.get(key);

    if (!record) {
      record = await this.createRecord(budgetId, organizationId, fiscalYear);
    }

    if (record.amount === amount) {
      // Nothing changed — mirrors `getActualChanges`' own unchanged-skip.
      return;
    }

    // Mirrors `BudgetService.updateRecord`'s "auto-sync initialAmount with
    // amount when Pending and the two were already equal" rule — see design
    // decision #4 above. Only `amount`/`initialAmount` are ever set; never
    // `preApprovedAmount`.
    const changes: { amount?: number; initialAmount?: number } = { amount };
    if (
      record.status === BudgetStatus.Pending &&
      record.amount === record.initialAmount
    ) {
      changes.initialAmount = amount;
    }

    await this.budgetRecords.update(record, changes);
  }

  private async createRecord(
    budgetId: ID<'Budget'>,
    organizationId: ID<'Organization'>,
    fiscalYear: number,
  ): Promise<UnsecuredDto<BudgetRecord>> {
    try {
      const id = await this.budgetRecords.create({
        budget: budgetId,
        organization: organizationId,
        fiscalYear,
      });
      return await this.budgetRecords.readOne(id);
    } catch (e) {
      if (!isUniqueViolation(e, 'budget_records_budget_org_fy_active_unique')) {
        throw e;
      }
      // Design decision #5 above — another concurrent create (e.g. the
      // Partnership-based sync) beat us to the same org+FY. Re-fetch instead
      // of failing this whole sync.
      const rows = await this.budgetRecords.readManyByBudget(budgetId);
      const found = rows.find(
        (row) =>
          row.organization === organizationId && row.fiscalYear === fiscalYear,
      );
      if (!found) {
        throw e;
      }
      return found;
    }
  }
}
