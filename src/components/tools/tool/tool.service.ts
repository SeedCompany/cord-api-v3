import { Injectable } from '@nestjs/common';
import { type ID, ServerException, type UnsecuredDto } from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../../authorization';
import {
  type CreateTool,
  Tool,
  type ToolListInput,
  type ToolListOutput,
  type UpdateTool,
} from './dto';
import { ToolRepository } from './tool.repository';

@Injectable()
export class ToolService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ToolRepository,
  ) {}

  @HandleIdLookup(Tool)
  async readOne(id: ID<Tool>): Promise<Tool> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: ReadonlyArray<ID<Tool>>) {
    const tools = await this.repo.readMany(ids);
    return tools.map((dto) => this.secure(dto));
  }

  async list(input: ToolListInput): Promise<ToolListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  private secure(dto: UnsecuredDto<Tool>): Tool {
    return this.privileges.for(Tool).secure(dto);
  }

  async create(input: CreateTool): Promise<Tool> {
    const dto = await this.repo.create(input);
    this.privileges.for(Tool, dto).verifyCan('create');
    return this.secure(dto);
  }

  async update(input: UpdateTool): Promise<Tool> {
    const tool = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(tool, input);
    this.privileges.for(Tool, tool).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID<Tool>): Promise<void> {
    const tool = await this.repo.readOne(id);
    this.privileges.for(Tool, tool).verifyCan('delete');
    try {
      await this.repo.deleteNode(tool);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }
}
