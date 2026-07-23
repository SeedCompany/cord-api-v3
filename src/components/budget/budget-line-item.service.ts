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

@Injectable()
export class BudgetLineItemService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: BudgetLineItemRepository,
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
    return await this.readOne(input.id);
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.readOne(id);
    this.privileges.for(BudgetLineItem, existing).verifyCan('delete');
    await this.repo.delete(id);
  }

  private secure(dto: UnsecuredDto<BudgetLineItem>): BudgetLineItem {
    return this.privileges.for(BudgetLineItem, dto).secure(dto);
  }
}
