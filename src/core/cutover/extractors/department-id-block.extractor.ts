import { type ID } from '~/common';
import { type IntRange } from '~/core/drizzle/int4-multirange';
import { departmentIdBlocks } from '~/core/drizzle/schema';
import { type ProjectType } from '../../../components/project/dto/project-type.enum';
import { bulkInsert, cypher, one } from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

interface BlockRow {
  id: ID;
  /** JSON string of inclusive ranges `[{start,end}]` (apoc-stored on the node). */
  blocks: string | null;
  programs: string[] | null;
}

const parseBlocks = (json: string | null): IntRange[] => {
  if (!json) return [];
  const parsed: unknown = JSON.parse(json);
  return Array.isArray(parsed) ? (parsed as IntRange[]) : [];
};

/**
 * DepartmentIdBlock — persistent blocks (the ones Partner/Project reference; the
 * FundingAccount-derived block is computed at read-time, never stored). Read
 * raw (no DTO readMany path): the Neo4j node keeps `blocks` as a JSON string of
 * inclusive `{start,end}` ranges, which map straight onto the `int4multirange`
 * column (its codec re-encodes inclusive → half-open).
 */
export const departmentIdBlockExtractor: Extractor = {
  name: 'departmentIdBlock',
  targetTables: ['department_id_blocks'],
  async run(ctx) {
    const rows = await cypher<BlockRow>(
      ctx,
      `MATCH (n:DepartmentIdBlock)
       RETURN n.id AS id, n.blocks AS blocks, n.programs AS programs`,
    );
    const mapped = rows.map((r) => ({
      id: r.id,
      range: parseBlocks(r.blocks),
      programs: (r.programs ?? []) as ProjectType[],
    }));
    return one(
      'department_id_blocks',
      rows.length,
      await bulkInsert(ctx, departmentIdBlocks, mapped),
    );
  },
};
