import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  generateId,
  type ID,
  type ResourceShape,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { DrizzleDtoRepository } from '~/core/drizzle/dto.repository';
import { resolveResourceBaseNode } from '~/core/drizzle/resolve-resource-base-node';
import {
  engagements,
  projects,
  type tools,
  toolUsages,
} from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import {
  type CreateToolUsage,
  type ToolContainerType,
  ToolUsage,
  type UpdateToolUsage,
} from './dto';

/**
 * Concrete container __typenames that roll up into each GraphQL
 * `ToolContainerType` bucket. The Cypher normalized labels with a CASE; we store
 * the concrete typename and expand the bucket here instead.
 *
 * migration-todo: if a new Project/Engagement subtype is added, extend this.
 * Keep in sync with the ToolContainerType enum.
 */
const CONTAINER_TYPES: Record<ToolContainerType, readonly string[]> = {
  Project: [
    'MomentumTranslationProject',
    'MultiplicationTranslationProject',
    'InternshipProject',
  ],
  Engagement: ['LanguageEngagement', 'InternshipEngagement'],
};

const bucketOf = (containerType: string): ToolContainerType | null =>
  CONTAINER_TYPES.Project.includes(containerType)
    ? 'Project'
    : CONTAINER_TYPES.Engagement.includes(containerType)
      ? 'Engagement'
      : null;

type ToolUsageRow = typeof toolUsages.$inferSelect & {
  tool?: typeof tools.$inferSelect | null;
};

@Injectable()
export class ToolUsageDrizzleRepository extends DrizzleDtoRepository<
  typeof toolUsages,
  ToolUsage
> {
  constructor(
    db: DrizzleService,
    private readonly identity: Identity,
  ) {
    super(db, toolUsages, ToolUsage as unknown as ResourceShape<ToolUsage>);
  }

  /**
   * Neo4j-shaped {@link BaseNode}s for the given container ids, looked up from
   * whichever table owns each one.
   *
   * The service (`readManyForContainers`) reads `container.properties.id` and
   * may fall back to `resolveTypeByBaseNode(container)`, and the resolver calls
   * `loadByBaseNode` — so this repo has to produce real BaseNodes rather than
   * the typed refs used elsewhere. `createdAt` is fetched rather than
   * fabricated even though nothing currently reads it.
   *
   * migration-todo: at cutover, `ToolUsage.container` should become a
   * `PolymorphicLinkTo` and this whole lookup disappears — `container_type`
   * already stores the concrete __typename, so no query would be needed.
   */
  private async containerBaseNodes(
    ids: readonly ID[],
  ): Promise<Map<ID, BaseNode>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const [projectRows, engagementRows] = await Promise.all([
      this.db
        .select({
          id: projects.id,
          type: projects.type,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(inArray(projects.id, unique as Array<ID<'Project'>>)),
      this.db
        .select({
          id: engagements.id,
          type: engagements.type,
          createdAt: engagements.createdAt,
        })
        .from(engagements)
        .where(inArray(engagements.id, unique as Array<ID<'Engagement'>>)),
    ]);
    const out = new Map<ID, BaseNode>();
    for (const row of projectRows) {
      out.set(row.id, {
        identity: row.id,
        labels: [`${row.type}Project`, 'Project', 'BaseNode'],
        properties: {
          id: row.id,
          createdAt: DateTime.fromJSDate(row.createdAt),
        },
      });
    }
    for (const row of engagementRows) {
      out.set(row.id, {
        identity: row.id,
        labels: [`${row.type}Engagement`, 'Engagement', 'BaseNode'],
        properties: {
          id: row.id,
          createdAt: DateTime.fromJSDate(row.createdAt),
        },
      });
    }
    return out;
  }

  /** Joined tool row is required — the DTO embeds the full Tool. */
  override async readMany(ids: readonly ID[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.query.toolUsages.findMany({
      where: (usage) =>
        and(inArray(usage.id, [...ids]), isNull(usage.deletedAt)),
      with: { tool: true },
    });
    const containers = await this.containerBaseNodes(
      rows.map((row) => row.containerId),
    );
    return rows.map((row) =>
      this.toDto(row as ToolUsageRow, containers.get(row.containerId)),
    );
  }

  protected toDto(
    row: ToolUsageRow,
    container?: BaseNode,
  ): UnsecuredDto<ToolUsage> {
    return {
      id: row.id,
      __typename: 'ToolUsage',
      container,
      tool: row.tool ? this.toolToDto(row.tool) : null,
      startDate: row.startDate ? DateTime.fromISO(row.startDate) : null,
      creator: { id: row.creatorId },
      createdAt: DateTime.fromJSDate(row.createdAt),
      modifiedAt: DateTime.fromJSDate(row.updatedAt),
    } as unknown as UnsecuredDto<ToolUsage>;
  }

  private toolToDto(row: typeof tools.$inferSelect) {
    return {
      id: row.id,
      __typename: 'Tool',
      name: row.name,
      description: row.description,
      aiBased: row.aiBased,
      key: row.key,
      createdAt: DateTime.fromJSDate(row.createdAt),
    };
  }

  /** Usages grouped by container, one entry per requested container id. */
  async listForContainers(containers: readonly ID[]) {
    if (containers.length === 0) return [];
    const rows = await this.db.query.toolUsages.findMany({
      where: (usage) =>
        and(
          inArray(usage.containerId, [...containers]),
          isNull(usage.deletedAt),
        ),
      with: { tool: true },
    });
    const nodes = await this.containerBaseNodes(containers);
    const byContainer = new Map<ID, Array<UnsecuredDto<ToolUsage>>>();
    for (const row of rows) {
      const list = byContainer.get(row.containerId) ?? [];
      list.push(this.toDto(row as ToolUsageRow, nodes.get(row.containerId)));
      byContainer.set(row.containerId, list);
    }
    // Only containers that actually resolved are returned — the Cypher matched
    // on `BaseNode`, so an id belonging to nothing yielded no row either.
    return containers.flatMap((id) => {
      const container = nodes.get(id);
      return container
        ? [{ container, usages: byContainer.get(id) ?? [] }]
        : [];
    }) as Array<{
      container: BaseNode;
      usages: ReadonlyArray<UnsecuredDto<ToolUsage>>;
    }>;
  }

  /** Usages grouped by tool, optionally restricted to a container bucket. */
  async listForTools(
    toolIds: readonly ID[],
    containerType?: ToolContainerType,
  ) {
    if (toolIds.length === 0) return [];
    const conditions = [
      inArray(toolUsages.toolId, [...toolIds]),
      isNull(toolUsages.deletedAt),
    ];
    if (containerType) {
      conditions.push(
        inArray(toolUsages.containerType, [...CONTAINER_TYPES[containerType]]),
      );
    }
    const rows = await this.db.query.toolUsages.findMany({
      where: () => and(...conditions),
      with: { tool: true },
    });
    const nodes = await this.containerBaseNodes(
      rows.map((row) => row.containerId),
    );
    const byTool = new Map<ID, Array<UnsecuredDto<ToolUsage>>>();
    for (const row of rows) {
      const list = byTool.get(row.toolId) ?? [];
      list.push(this.toDto(row as ToolUsageRow, nodes.get(row.containerId)));
      byTool.set(row.toolId, list);
    }
    return toolIds.map((id) => ({
      tool: { id },
      usages: byTool.get(id) ?? [],
    })) as Array<{
      tool: { id: ID };
      usages: ReadonlyArray<UnsecuredDto<ToolUsage>>;
    }>;
  }

  /**
   * Per-tool counts bucketed by container type. Mirrors the Cypher's
   * label-normalizing CASE + `WHERE containerType IS NOT NULL`: containers that
   * are neither Project nor Engagement are omitted entirely.
   */
  async containerSummaryForTools(toolIds: readonly ID[]) {
    if (toolIds.length === 0) return [];
    const rows = await this.db
      .select({
        toolId: toolUsages.toolId,
        containerType: toolUsages.containerType,
        total: sql<number>`count(*)::int`,
      })
      .from(toolUsages)
      .where(
        and(
          inArray(toolUsages.toolId, [...toolIds]),
          isNull(toolUsages.deletedAt),
        ),
      )
      .groupBy(toolUsages.toolId, toolUsages.containerType);

    // Concrete typenames roll up into buckets, so sum after mapping.
    const totals = new Map<string, number>();
    for (const row of rows) {
      const bucket = bucketOf(row.containerType);
      if (!bucket) continue;
      const key = `${row.toolId} ${bucket}`;
      totals.set(key, (totals.get(key) ?? 0) + row.total);
    }
    return [...totals.entries()].map(([key, total]) => {
      const [toolId, containerType] = key.split(' ');
      return {
        tool: { id: toolId as ID },
        containerType: containerType!,
        total,
      };
    }) as Array<{ tool: { id: ID }; containerType: string; total: number }>;
  }

  async usageFor(container: ID<'Resource'>, tool: ID<'Tool'>) {
    const row = await this.db.query.toolUsages.findFirst({
      where: (usage) =>
        and(
          eq(usage.containerId, container),
          eq(usage.toolId, tool),
          isNull(usage.deletedAt),
        ),
      with: { tool: true },
    });
    if (!row) return null;
    const nodes = await this.containerBaseNodes([row.containerId]);
    return this.toDto(row as ToolUsageRow, nodes.get(row.containerId));
  }

  async create(input: CreateToolUsage) {
    const container = await resolveResourceBaseNode(this.db, input.container);
    if (!container) {
      throw new CreationFailed(ToolUsage);
    }
    // labels are [Concrete, Interface, 'BaseNode'] — the concrete one is first.
    const containerType = container.labels[0]!;

    const id = await generateId<ID<'ToolUsage'>>();
    const [row] = await this.db
      .insert(toolUsages)
      .values({
        id,
        containerId: input.container,
        containerType,
        toolId: input.tool,
        creatorId: this.identity.current.userId,
        startDate: input.startDate?.toISODate() ?? null,
      })
      .returning();
    if (!row) {
      throw new CreationFailed(ToolUsage);
    }
    return await this.readOne(row.id);
  }

  async update(changes: UpdateToolUsage) {
    const { id, ...simple } = changes;
    await this.updateColumns(id, {
      ...('startDate' in simple
        ? { startDate: simple.startDate?.toISODate() ?? null }
        : {}),
    });
    return await this.readOne(id);
  }

  async deleteNode(objectOrId: { id: ID } | ID) {
    const id = typeof objectOrId === 'string' ? objectOrId : objectOrId.id;
    await this.softDelete(id);
  }

  async getBaseNode(id: ID, _resource?: unknown) {
    return await resolveResourceBaseNode(this.db, id);
  }
}
