import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../../../components/authorization';
import { ToolService } from '../tool/tool.service';
import { type CreateToolUsage, ToolUsage, type UpdateToolUsage } from './dto';
import { ToolUsageRepository } from './tool-usage.repository';

@Injectable()
export class ToolUsageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ToolUsageRepository,
    private readonly toolService: ToolService,
  ) {}

  async create(input: CreateToolUsage): Promise<ToolUsage> {
    const dto = await this.repo.create(input);
    this.privileges.for(ToolUsage).verifyCan('create');
    return this.secure(dto);
  }

  private secure(dto: UnsecuredDto<ToolUsage>): ToolUsage {
    return {
      ...dto,
      canDelete: true,
      container: this.secureBaseNode(dto.container),
      startDate: this.secureField((dto as any).startDate),
      tool: dto.tool as any, // Tool is already hydrated properly, don't double-secure it
    };
  }

  private secureBaseNode(node: any) {
    return {
      ...node,
      canRead: true,
      canEdit: false,
    };
  }

  private secureField<T>(value: T) {
    return {
      value,
      canRead: true,
      canEdit: false,
    };
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

  async findByContainerId(containerId: ID): Promise<ToolUsage[]> {
    const toolUsages = await this.repo.findByContainerId(containerId);
    return toolUsages.map((dto) => this.secure(dto));
  }
}
