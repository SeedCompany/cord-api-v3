import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { type ToolContainerType, ToolUsage } from './dto';
import { type ToolUsageRepository as Neo4jRepository } from './tool-usage.neo4j.repository';

const engagementSubtypes = new Set([
  'LanguageEngagement',
  'InternshipEngagement',
]);
const projectSubtypes = new Set([
  'MomentumTranslationProject',
  'MultiplicationTranslationProject',
  'InternshipProject',
]);

const resAsBaseNode = e.shape(e.Resource, (res) => ({
  identity: res.id,
  labels: e.array_agg(e.set(res.__type__.name)),
  properties: e.select({
    id: res.id,
    createdAt: res.createdAt,
  }),
}));

@Injectable()
export class ToolUsageRepository
  extends RepoFor(ToolUsage, {
    hydrate: (usage) => ({
      ...usage['*'],
      container: resAsBaseNode(usage.container),
      tool: usage.tool['*'],
      creator: usage.createdBy,
    }),
  })
  implements PublicOf<Neo4jRepository>
{
  async listForContainers(containers: readonly ID[]) {
    return await this.db.run(this.listForContainersQuery, { containers });
  }
  private readonly listForContainersQuery = e.params(
    { containers: e.array(e.uuid) },
    ($) => {
      const containers = e.cast(e.Resource, e.array_unpack($.containers));
      return e.select(containers, (container) => ({
        container: e.select(container, resAsBaseNode),
        usages: e.select(container.tools, this.hydrate),
      }));
    },
  );

  async listForTools(tools: readonly ID[], containerType?: ToolContainerType) {
    if (containerType) {
      return await this.db.run(
        this.makeListForToolsWithTypeFilter(containerType),
        { tools },
      );
    }
    return await this.db.run(this.listForToolsQuery, { tools });
  }
  private readonly listForToolsQuery = e.params(
    { tools: e.array(e.uuid) },
    ($) => {
      const tools = e.cast(e.Tool, e.array_unpack($.tools));
      return e.select(tools, (tool) => ({
        tool: e.select(tool, (c) => ({ id: c.id })),
        usages: e.select(tool.usages, this.hydrate),
      }));
    },
  );

  private makeListForToolsWithTypeFilter(containerType: ToolContainerType) {
    const fqns =
      containerType === 'Engagement'
        ? ['default::LanguageEngagement', 'default::InternshipEngagement']
        : [
            'default::MomentumTranslationProject',
            'default::MultiplicationTranslationProject',
            'default::InternshipProject',
          ];
    return e.params({ tools: e.array(e.uuid) }, ($) => {
      const tools = e.cast(e.Tool, e.array_unpack($.tools));
      return e.select(tools, (tool) => ({
        tool: e.select(tool, (c) => ({ id: c.id })),
        usages: e.select(tool.usages, (usage) => ({
          ...this.hydrate(usage),
          filter: e.op(
            usage.container.__type__.name,
            'in',
            e.array_unpack(e.literal(e.array(e.str), fqns)),
          ),
        })),
      }));
    });
  }

  async containerSummaryForTools(tools: readonly ID[]) {
    const raw = await this.db.run(this.containerSummaryQuery, { tools });
    // e.group returns { key: { containerType }, grouping, elements }[] per tool.
    // Normalize concrete Gel subtypes to enum values and merge totals so grouping
    // uses the normalized type (avoids duplicate rows when multiple concrete subtypes
    // map to the same enum value, e.g. LanguageEngagement + InternshipEngagement → Engagement).
    return raw.flatMap(({ tool, summary }) => {
      const totals = new Map<string, number>();
      for (const { key, elements } of summary) {
        const rawType = (key.containerType as string).replace(/^default::/, '');
        const containerType = engagementSubtypes.has(rawType)
          ? 'Engagement'
          : projectSubtypes.has(rawType)
            ? 'Project'
            : rawType;
        totals.set(
          containerType,
          (totals.get(containerType) ?? 0) + elements.length,
        );
      }
      return [...totals.entries()].map(([containerType, total]) => ({
        tool,
        containerType,
        total,
      }));
    });
  }
  private readonly containerSummaryQuery = e.params(
    { tools: e.array(e.uuid) },
    ($) => {
      const tools = e.cast(e.Tool, e.array_unpack($.tools));
      return e.select(tools, (tool) => ({
        tool: e.select(tool, (t) => ({ id: t.id })),
        summary: e.group(tool.usages, (usage) => ({
          by: { containerType: usage.container.__type__.name },
        })),
      }));
    },
  );

  async usageFor(container: ID<'Resource'>, tool: ID<'Tool'>) {
    return await this.db.run(this.usageForQuery, { container, tool });
  }
  private readonly usageForQuery = e.params(
    { container: e.uuid, tool: e.uuid },
    ($) =>
      e.select(e.Tool.Usage, (usage) => ({
        ...this.hydrate(usage),
        filter_single: {
          tool: e.cast(e.Tool, $.tool),
          container: e.cast(e.Resource, $.container),
        },
      })),
  );
}
