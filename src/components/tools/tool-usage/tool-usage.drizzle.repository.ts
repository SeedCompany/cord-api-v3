import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  generateId,
  type ID,
  type ResourceShape,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { DrizzleDtoRepository } from '~/core/drizzle/dto.repository';
import {
  ENGAGEMENT_TYPENAMES,
  PROJECT_TYPENAMES,
  resolveResourceBaseNode,
  resolveResourceBaseNodes,
  resolveResourceBaseNodesByType,
} from '~/core/drizzle/resolve-resource-base-node';
import { tools, toolUsages } from '~/core/drizzle/schema';
import { ILogger, Logger } from '~/core/logger';
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
 * Derived from the DB enums, so adding a Project/Engagement subtype extends the
 * buckets automatically. Containers outside these two families are legal (any
 * resource may hold tool usages) and bucket to null, exactly as the Cypher's
 * CASE + `WHERE containerType IS NOT NULL` dropped them from the summary.
 */
const CONTAINER_TYPES: Record<ToolContainerType, readonly string[]> = {
  Project: PROJECT_TYPENAMES,
  Engagement: ENGAGEMENT_TYPENAMES,
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
    @Logger('tool-usage:repository') private readonly logger: ILogger,
  ) {
    super(db, toolUsages, ToolUsage as unknown as ResourceShape<ToolUsage>);
  }

  /**
   * Neo4j-shaped {@link BaseNode}s for the containers of the given usage rows,
   * resolved through the shared resource-table registry.
   *
   * The service (`readManyForContainers`) reads `container.properties.id` and
   * may fall back to `resolveTypeByBaseNode(container)`, and the resolver calls
   * `loadByBaseNode` — so this repo has to produce real BaseNodes rather than
   * the typed refs used elsewhere.
   *
   * Containers are deliberately NOT restricted to Project/Engagement: the
   * `container` input is an `ID<'Resource'>`, the Cypher matches any `BaseNode`,
   * and `Resource.tools` is a field on the `Resource` interface — so any
   * resource may be a container, and more are expected over time. That is why
   * this keys off the stored `container_type` and reports types the registry
   * does not cover instead of dropping them: an uncovered type is a registry
   * gap, and must not be indistinguishable from a deleted container.
   *
   * migration-todo: at cutover, `ToolUsage.container` should become a
   * `PolymorphicLinkTo` and this whole lookup disappears — `container_type`
   * already stores the concrete __typename, so no query would be needed.
   */
  private async containerBaseNodesFor(
    rows: ReadonlyArray<{ containerId: ID; containerType: string }>,
  ): Promise<ReadonlyMap<ID, BaseNode>> {
    if (rows.length === 0) return new Map();
    const { nodes, unknownTypes } = await resolveResourceBaseNodesByType(
      this.db,
      rows.map((row) => ({ id: row.containerId, type: row.containerType })),
    );
    if (unknownTypes.size > 0) {
      this.logger.error(
        'Tool usage containers reference resource types the Drizzle resource-table registry does not cover; their usages are being omitted',
        { containerTypes: [...unknownTypes] },
      );
    }
    return nodes;
  }

  /** Joined tool row is required — the DTO embeds the full Tool. */
  override async readMany(ids: readonly ID[]) {
    if (ids.length === 0) return [];
    const rows = await this.db.query.toolUsages.findMany({
      where: (usage) =>
        and(inArray(usage.id, [...ids]), isNull(usage.deletedAt)),
      with: { tool: true },
    });
    const containers = await this.containerBaseNodesFor(rows);
    // A usage whose container no longer resolves is dropped, not returned with a
    // hole: the Cypher's `node(container, 'BaseNode')` match was required, so
    // Neo4j never yielded such a row either. Returning it would hand the service
    // an unloadable container and surface as NotFoundException on a non-null
    // field. Callers see a missing id, which readOne turns into NotFound.
    return rows.flatMap((row) => {
      const container = containers.get(row.containerId);
      return container ? [this.toDto(row as ToolUsageRow, container)] : [];
    });
  }

  /**
   * `container` stays optional only because the base class declares a 1-arg
   * `toDto`; it is required in practice, and passing nothing is a bug. Every
   * caller must resolve a LIVE container first and drop the row if it cannot —
   * letting `undefined` through is what allowed a soft-deleted container to
   * travel to the service as a hole in a non-null GraphQL field. Failing loudly
   * here keeps that from silently reappearing.
   */
  protected toDto(
    row: ToolUsageRow,
    container?: BaseNode,
  ): UnsecuredDto<ToolUsage> {
    if (!container) {
      throw new ServerException(
        'Tool usage container must be resolved before building its DTO',
      );
    }
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
    // Only ids are given here, with no discriminator to key off — the caller
    // asks about containers that may hold no usages at all. So probe by id
    // instead: one query per registry table, flat as the page grows.
    const nodes = await resolveResourceBaseNodes(this.db, containers);
    const byContainer = new Map<ID, Array<UnsecuredDto<ToolUsage>>>();
    for (const row of rows) {
      const container = nodes.get(row.containerId);
      if (!container) continue;
      const list = byContainer.get(row.containerId) ?? [];
      list.push(this.toDto(row as ToolUsageRow, container));
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
    const nodes = await this.containerBaseNodesFor(rows);
    const byTool = new Map<ID, Array<UnsecuredDto<ToolUsage>>>();
    for (const row of rows) {
      // Drop rather than emit a container-less usage — one dead container would
      // otherwise null out every tool in the list via non-null propagation.
      const container = nodes.get(row.containerId);
      if (!container) continue;
      const list = byTool.get(row.toolId) ?? [];
      list.push(this.toDto(row as ToolUsageRow, container));
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
      const key = `${row.toolId}\u0000${bucket}`;
      totals.set(key, (totals.get(key) ?? 0) + row.total);
    }
    return [...totals.entries()].map(([key, total]) => {
      const [toolId, containerType] = key.split('\u0000');
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
    const nodes = await this.containerBaseNodesFor([row]);
    const containerNode = nodes.get(row.containerId);
    // No live container means the Cypher would have matched nothing — the
    // service reads this as "no existing usage", which is the right answer.
    if (!containerNode) return null;
    return this.toDto(row as ToolUsageRow, containerNode);
  }

  async create(input: CreateToolUsage) {
    const container = await resolveResourceBaseNode(this.db, input.container);
    if (!container) {
      throw new CreationFailed(ToolUsage);
    }
    // labels are [Concrete, Interface, 'BaseNode'] — the concrete one is first.
    const containerType = container.labels[0]!;

    // The foreign key proves only that the tool row exists, and a soft-deleted
    // tool still satisfies it. Neo4j's create matches `:Tool`, and deleting a
    // tool there renames the label to `Deleted_Tool`, so a deleted tool matches
    // nothing and the whole create fails. Without this check Postgres would
    // happily store a usage pointing at a tool no read can return.
    const [liveTool] = await this.db
      .select({ id: tools.id })
      .from(tools)
      .where(and(eq(tools.id, input.tool), isNull(tools.deletedAt)));
    if (!liveTool) {
      throw new CreationFailed(ToolUsage);
    }

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
