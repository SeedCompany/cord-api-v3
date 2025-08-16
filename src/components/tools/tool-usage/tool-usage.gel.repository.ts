import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { ToolUsage } from './dto';
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
        container: e.select(container, (c) => ({ id: c.id })),
        usages: e.select(container.tools, this.hydrate),
      }));
    },
  );

  async listForTools(tools: readonly ID[]) {
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
}
