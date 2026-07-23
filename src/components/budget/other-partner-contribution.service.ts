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

@Injectable()
export class OtherPartnerContributionService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: OtherPartnerContributionRepository,
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
    return await this.readOne(input.id);
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.readOne(id);
    this.privileges.for(OtherPartnerContribution, existing).verifyCan('delete');
    await this.repo.delete(id);
  }

  private secure(
    dto: UnsecuredDto<OtherPartnerContribution>,
  ): OtherPartnerContribution {
    return this.privileges.for(OtherPartnerContribution, dto).secure(dto);
  }
}
