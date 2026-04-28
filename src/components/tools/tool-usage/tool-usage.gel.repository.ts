import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { type ToolContainerType, ToolUsage } from './dto';
import { type ToolUsageRepository as Neo4jRepository } from './tool-usage.neo4j.repository';

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
        ? ([
            'default::LanguageEngagement',
            'default::InternshipEngagement',
          ] as const)
        : ([`default::${containerType}`] as const);
    return e.params({ tools: e.array(e.uuid) }, ($) => {
      const tools = e.cast(e.Tool, e.array_unpack($.tools));
      return e.select(tools, (tool) => ({
        tool: e.select(tool, (c) => ({ id: c.id })),
        usages: e.select(tool.usages, (usage) => ({
          ...this.hydrate(usage),
          filter:
            fqns.length === 1
              ? e.op(usage.container.__type__.name, '=', e.str(fqns[0]))
              : e.op(
                  e.op(usage.container.__type__.name, '=', e.str(fqns[0])),
                  'or',
                  e.op(usage.container.__type__.name, '=', e.str(fqns[1])),
                ),
        })),
      }));
    });
  }

  async containerSummaryForTools(tools: readonly ID[]) {
    const raw = await this.db.run(this.containerSummaryQuery, { tools });
    // e.group returns { key: { containerType }, grouping, elements }[] — flatten to match Neo4j shape
    return raw.flatMap(({ tool, summary }) =>
      summary.map(({ key, elements }) => {
        const rawType = (key.containerType as string).replace(/^default::/, '');
        const containerType =
          rawType === 'LanguageEngagement' || rawType === 'InternshipEngagement'
            ? 'Engagement'
            : rawType;
        return { tool, containerType, total: elements.length };
      }),
    );
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
