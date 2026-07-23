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
import { BudgetLineItemRepository } from './budget-line-item.repository';
import {
  BudgetLineItem,
  type CreateBudgetLineItem,
  type UpdateBudgetLineItem,
} from './dto';
import { SyncLineItemsToBudgetRecordsService } from './sync-line-items-to-budget-records.service';

@Injectable()
export class BudgetLineItemService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: BudgetLineItemRepository,
    private readonly sync: SyncLineItemsToBudgetRecordsService,
  ) {}

  /**
   * Verifies `create` AFTER inserting, once `scope` (project membership) is
   * known from the read-back join — mirrors `PartnershipService.create()`'s
   * same create-then-verify order for this same style of project-scoped,
   * `member`-gated child resource.
   */
  async create(input: CreateBudgetLineItem): Promise<BudgetLineItem> {
    try {
      const id = await this.repo.create(input);
      const lineItem = await this.readOne(id);
      this.privileges.for(BudgetLineItem, lineItem).verifyCan('create');
      // budget-line-items-poc phase 3: keep budget_records.amount in sync —
      // see sync-line-items-to-budget-records.service.ts's doc comment for
      // the full design (what it does and does not attribute).
      await this.sync.syncForBudget(input.budget);
      return lineItem;
    } catch (exception) {
      throw new CreationFailed(BudgetLineItem, { cause: exception });
    }
  }

  @HandleIdLookup(BudgetLineItem)
  async readOne(id: ID, _view?: ObjectView): Promise<BudgetLineItem> {
    const [dto] = await this.repo.readMany([id]);
    if (!dto) {
      throw new ServerException('Could not find BudgetLineItem');
    }
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[]): Promise<readonly BudgetLineItem[]> {
    const rows = await this.repo.readMany(ids);
    return rows.map((dto) => this.secure(dto));
  }

  /** Used by `BudgetResolver.lineItems` / `BudgetService.readOne`. */
  async listByBudget(
    budgetId: ID<'Budget'>,
  ): Promise<readonly BudgetLineItem[]> {
    const rows = await this.repo.listByBudget(budgetId);
    return rows.map((dto) => this.secure(dto));
  }

  async update(input: UpdateBudgetLineItem): Promise<BudgetLineItem> {
    const existing = await this.readOne(input.id);
    const changes = this.repo.getActualChanges(existing, input);
    this.privileges.for(BudgetLineItem, existing).verifyChanges(changes);
    await this.repo.update(input.id, changes);
    const updated = await this.readOne(input.id);
    // budget-line-items-poc phase 3: see create()'s comment.
    await this.sync.syncForBudget(await this.repo.getBudgetId(input.id));
    return updated;
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.readOne(id);
    this.privileges.for(BudgetLineItem, existing).verifyCan('delete');
    const budgetId = await this.repo.getBudgetId(id);
    await this.repo.delete(id);
    // budget-line-items-poc phase 3: see create()'s comment.
    await this.sync.syncForBudget(budgetId);
  }

  private secure(dto: UnsecuredDto<BudgetLineItem>): BudgetLineItem {
    return this.privileges.for(BudgetLineItem, dto).secure(dto);
  }
}
