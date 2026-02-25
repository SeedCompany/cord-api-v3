import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  type ID,
  NotFoundException,
  type PublicOf,
} from '~/common';
import { e, RepoFor } from '~/core/gel';
import { Tool } from './dto';
import { type ToolKey } from './dto/tool-key.enum';
import { type ToolRepository as Neo4jRepository } from './tool.neo4j.repository';

@Injectable()
export class ToolRepository
  extends RepoFor(Tool, {
    hydrate: (tool) => ({
      ...tool['*'],
    }),
  })
  implements PublicOf<Neo4jRepository>
{
  async idByKey(key: ToolKey): Promise<ID<'Tool'>> {
    const query = e
      .select(e.Tool, (tool) => ({
        filter: e.op(tool.key, '=', e.cast(e.Tool.Key, key)),
        id: true,
      }))
      .assert_single();

    const result = await this.db.run(query);
    if (!result) {
      throw new NotFoundException('Tool not found', 'key');
    }
    const { id } = result;
    return id;
  }

  async assertKeyUnassigned(key: ToolKey, excludeId: ID | undefined) {
    const query = e
      .select(e.Tool, (tool) => ({
        filter: e.op(tool.key, '=', e.cast(e.Tool.Key, key)),
        id: true,
      }))
      .assert_single();

    const result = await this.db.run(query);
    if (result && result.id !== excludeId) {
      throw new DuplicateException(
        'key',
        'Key is already assigned to another tool.',
      );
    }
  }
}
