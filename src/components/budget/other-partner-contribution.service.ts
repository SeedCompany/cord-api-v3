import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import {
  type CreateOtherPartnerContribution,
  OtherPartnerContribution,
  type UpdateOtherPartnerContribution,
} from './dto';
import { OtherPartnerContributionRepository } from './other-partner-contribution.repository';
import { SyncLineItemsToBudgetRecordsService } from './sync-line-items-to-budget-records.service';

@Injectable()
export class OtherPartnerContributionService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: OtherPartnerContributionRepository,
    private readonly sync: SyncLineItemsToBudgetRecordsService,
  ) {}

  /**
   * Verifies `create` AFTER inserting — see `BudgetLineItemService.create()`
   * for why (mirrors `PartnershipService.create()`'s order).
   */
  async create(
    input: CreateOtherPartnerContribution,
  ): Promise<OtherPartnerContribution> {
    try {
      const id = await this.repo.create(input);
      const opc = await this.readOne(id);
      this.privileges.for(OtherPartnerContribution, opc).verifyCan('create');
      // budget-line-items-poc phase 3: wired per the task's explicit
      // "after each BudgetLineItem/OtherPartnerContribution create/update
      // /delete" — currently a no-op for OPC specifically, since
      // sync-line-items-to-budget-records.service.ts's algorithm only sums
      // `BudgetLineItem.funder` amounts, not OPC's `donor`. See that file's
      // doc comment.
      await this.sync.syncForBudget(input.budget);
      return opc;
    } catch (exception) {
      throw new CreationFailed(OtherPartnerContribution, {
        cause: exception,
      });
    }
  }

  @HandleIdLookup(OtherPartnerContribution)
  async readOne(id: ID, _view?: ObjectView): Promise<OtherPartnerContribution> {
    const [dto] = await this.repo.readMany([id]);
    if (!dto) {
      throw new ServerException('Could not find OtherPartnerContribution');
    }
    return this.secure(dto);
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<readonly OtherPartnerContribution[]> {
    const rows = await this.repo.readMany(ids);
    return rows.map((dto) => this.secure(dto));
  }

  /** Used by `BudgetResolver.otherPartnerContributions` / `BudgetService.readOne`. */
  async listByBudget(
    budgetId: ID<'Budget'>,
  ): Promise<readonly OtherPartnerContribution[]> {
    const rows = await this.repo.listByBudget(budgetId);
    return rows.map((dto) => this.secure(dto));
  }

  async update(
    input: UpdateOtherPartnerContribution,
  ): Promise<OtherPartnerContribution> {
    const existing = await this.readOne(input.id);
    const changes = this.repo.getActualChanges(existing, input);
    this.privileges
      .for(OtherPartnerContribution, existing)
      .verifyChanges(changes);
    await this.repo.update(input.id, changes);
    const updated = await this.readOne(input.id);
    // budget-line-items-poc phase 3: see create()'s comment.
    await this.sync.syncForBudget(await this.repo.getBudgetId(input.id));
    return updated;
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.readOne(id);
    this.privileges.for(OtherPartnerContribution, existing).verifyCan('delete');
    const budgetId = await this.repo.getBudgetId(id);
    await this.repo.delete(id);
    // budget-line-items-poc phase 3: see create()'s comment.
    await this.sync.syncForBudget(budgetId);
  }

  private secure(
    dto: UnsecuredDto<OtherPartnerContribution>,
  ): OtherPartnerContribution {
    return this.privileges.for(OtherPartnerContribution, dto).secure(dto);
  }
}
