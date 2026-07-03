import { tools } from '~/core/drizzle/schema';
import { type Tool } from '../../../components/tools/tool/dto';
import { ToolRepository } from '../../../components/tools/tool/tool.neo4j.repository';
import { bulkInsert, readAllViaRepo, stat, tsReq } from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Tool — the reference extractor. Leaf domain, no FKs, no junctions. Read every
 * `Tool` node via the Neo4j repo (hydrates name/description/aiBased/key from
 * their Property nodes), map to the `tools` row shape, insert ID-preserving.
 */
export const toolExtractor: Extractor = {
  name: 'tool',
  targetTables: ['tools'],
  async run(ctx) {
    const dtos = await readAllViaRepo<Tool>(ctx, 'Tool', ToolRepository);
    const rows = dtos.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      aiBased: t.aiBased,
      key: t.key ?? null,
      createdAt: tsReq(t.createdAt),
      // Neo4j Tool has no separate modifiedAt; seed updatedAt = createdAt.
      updatedAt: tsReq(t.createdAt),
      // migration-todo: readMany returns live rows only; deleted Tools (if the
      // Neo4j model retains any) are not carried. Confirm before cutover.
      deletedAt: null,
    }));
    const inserted = await bulkInsert(ctx, tools, rows);
    return { tools: stat(dtos.length, inserted) };
  },
};
