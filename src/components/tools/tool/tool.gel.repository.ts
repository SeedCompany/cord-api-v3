import { Injectable } from '@nestjs/common';
import { type PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { Tool } from './dto';
import { type ToolRepository as Neo4jRepository } from './tool.neo4j.repository';

@Injectable()
export class ToolRepository
  extends RepoFor(Tool, {
    hydrate: (tool) => ({
      ...tool['*'],
    }),
  })
  implements PublicOf<Neo4jRepository> {}
