import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  isIdLike,
  NotFoundException,
  Resource,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader } from '~/core';
import { type BaseNode, isBaseNode } from '~/core/database/results';
import { Privileges } from '../../authorization';
import { Tool } from '../tool/dto';
import { type CreateToolUsage, ToolUsage, type UpdateToolUsage } from './dto';
import { ToolUsageRepository } from './tool-usage.neo4j.repository';

type TypedResource = Resource & { __typename: string };
type ResourceRef = TypedResource | ID<Resource> | BaseNode;

@Injectable()
export class ToolUsageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly repo: ToolUsageRepository,
  ) {}

  @HandleIdLookup(ToolUsage)
  async readOne(id: ID<ToolUsage>): Promise<ToolUsage> {
    const dto = await this.repo.readOne(id);
    const container = await this.loadContainer(dto.container);
    const usage = this.secure(dto, container);
    if (!usage) {
      throw new NotFoundException('Tool usage not found', 'id');
    }
    return usage;
  }

  async readMany(ids: ReadonlyArray<ID<ToolUsage>>) {
    const dtos = await this.repo.readMany(ids);
    const secured = await Promise.all(
      dtos.map(async (dto) => {
        const container = await this.loadContainer(dto.container);
        return this.secure(dto, container) ?? [];
      }),
    );
    return secured.flat();
  }

  async readByContainer(container: Resource): Promise<readonly ToolUsage[]> {
    const dtos = await this.repo.listForContainer(container.id);
    return dtos.flatMap((dto) => this.secure(dto, container) ?? []);
  }

  private secure(
    dto: UnsecuredDto<ToolUsage>,
    container: Resource,
  ): ToolUsage | null {
    const secured = {
      ...this.privileges.for(ToolUsage, { ...container, ...dto }).secure(dto),
      tool: this.privileges.for(Tool).secure(dto.tool),
    };
    return secured.container.canRead ? secured : null;
  }

  private async loadContainer(container: ResourceRef): Promise<TypedResource> {
    const node = isIdLike(container)
      ? await this.repo.getBaseNode(container, Resource)
      : container;
    if (!node) {
      throw new NotFoundException('Resource does not exist', 'container');
    }
    const loaded = isBaseNode(node)
      ? ((await this.resources.loadByBaseNode(node)) as TypedResource)
      : node;
    return loaded;
  }

  async create(input: CreateToolUsage): Promise<ToolUsage> {
    const container = await this.loadContainer(input.container);
    if (
      container.__typename === 'Tool' ||
      container.__typename === 'ToolUsage'
    ) {
      throw new InputException('No recursion');
    }

    const dto = await this.repo.create(input);
    this.privileges
      .for(ToolUsage, { ...container, ...dto })
      .verifyCan('create');
    return this.secure(dto, container)!;
  }

  async update(input: UpdateToolUsage): Promise<ToolUsage> {
    const dto = await this.repo.readOne(input.id);
    const changes = this.repo.getActualChanges(dto, input);
    const container = await this.loadContainer(dto.container);
    this.privileges
      .for(ToolUsage, { ...container, ...dto })
      .verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, container)!;
  }

  async delete(id: ID): Promise<void> {
    const dto = await this.repo.readOne(id);
    const container = await this.loadContainer(dto.container);
    this.privileges
      .for(ToolUsage, { ...container, ...dto })
      .verifyCan('delete');
    try {
      await this.repo.deleteNode(dto);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }
}
