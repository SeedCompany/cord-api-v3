import { Injectable } from '@nestjs/common';
import { ID, ObjectView, ServerException, type UnsecuredDto } from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../../../components/authorization';
import { ToolService } from '../tool.service';
import { type CreateToolUsage, ToolUsage, type UpdateToolUsage } from './dto';
import { ToolUsageRepository } from './tool-usage.repository';

@Injectable()
export class ToolUsageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ToolUsageRepository,
    private readonly toolService: ToolService,
  ) {}

  async listAllByEngagementId(engagementId: ID<'Engagement'>) {
    const results = await this.repo.listAllByEngagementId(engagementId);
    // eslint-disable-next-line no-console
    console.log('ToolUsageService.listAllByEngagementId results:', results);
    return results;
  }

  async create(input: CreateToolUsage): Promise<ToolUsage> {
    const dto = await this.repo.create(input);
    this.privileges.for(ToolUsage).verifyCan('create');
    return this.secure(dto);
  }
  private secure(dto: UnsecuredDto<ToolUsage>) {
    return this.privileges.for(ToolUsage).secure(dto);
  }

  async update(input: UpdateToolUsage): Promise<ToolUsage> {
    const toolUsage = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(toolUsage, input);
    this.privileges.for(ToolUsage, toolUsage).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const toolUsage = await this.repo.readOne(id);
    this.privileges.for(ToolUsage, toolUsage).verifyCan('delete');
    try {
      await this.repo.deleteNode(toolUsage);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  @HandleIdLookup(ToolUsage)
  async readOne(id: ID, _view?: ObjectView): Promise<ToolUsage> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const toolUsages = await this.repo.readMany(ids);
    return toolUsages.map((dto) => this.secure(dto));
  }
}
