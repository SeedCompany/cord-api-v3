import { Injectable } from '@nestjs/common';
import { mapKeys } from '@seedcompany/common';
import {
  DuplicateException,
  EnhancedResource,
  type ID,
  InputException,
  isIdLike,
  NotFoundException,
  Resource,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader, ResourceResolver } from '~/core';
import { type BaseNode, isBaseNode } from '~/core/database/results';
import { Privileges } from '../../authorization';
import { Tool } from '../tool/dto';
import { type CreateToolUsage, ToolUsage, type UpdateToolUsage } from './dto';
import { type UsagesByContainer } from './tool-usage-by-container.loader';
import { type UsagesByTool } from './tool-usage-by-tool.loader';
import { ToolUsageRepository } from './tool-usage.neo4j.repository';

type TypedResource = Resource & { __typename: string };
type ResourceRef = TypedResource | ID<Resource> | BaseNode;

@Injectable()
export class ToolUsageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly resourceResolver: ResourceResolver,
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

  async readManyForContainers(containers: readonly Resource[]) {
    const containersById = mapKeys.fromList(containers, (r) => r.id).asMap;
    const rows = await this.repo.listForContainers(containers.map((r) => r.id));
    return rows.map((row): UsagesByContainer => {
      const container = containersById.get(row.container.properties.id)!;

      const typeName =
        container.__typename ??
        this.resourceResolver.resolveTypeByBaseNode(row.container);
      const containerType = EnhancedResource.resolve(
        typeName,
      ) as EnhancedResource<typeof Resource>;

      const usages = row.usages.flatMap(
        (dto) => this.secure(dto, container) ?? [],
      );
      return {
        container,
        usages: {
          items: usages,
          total: usages.length,
          hasMore: false,

          canRead: true,
          canCreate: this.privileges
            .for(containerType, container)
            .can('create', 'tools'),
        },
      };
    });
  }

  async readManyForTools(tools: readonly Tool[]) {
    const toolsById = mapKeys.fromList(tools, (t) => t.id).asMap;
    const rows = await this.repo.listForTools(tools.map((t) => t.id));
    return await Promise.all(
      rows.map(async (row): Promise<UsagesByTool> => {
        const tool = toolsById.get(row.tool.id)!;
        const usages = await Promise.all(
          row.usages.map(async (dto) => {
            const container = await this.loadContainer(dto.container);
            return this.secure(dto, container) ?? [];
          }),
        );
        return { tool, usages: usages.flat() };
      }),
    );
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
    const prev = await this.repo.usageFor(input.container, input.tool);
    if (prev) {
      throw new DuplicateException(
        'tool',
        'This resource already uses this tool',
      );
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
