import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { ToolDrizzleRepository } from './tool.drizzle.repository';
import { ToolRepository as GelRepository } from './tool.gel.repository';
import { ToolLoader } from './tool.loader';
import { ToolRepository as Neo4jRepository } from './tool.neo4j.repository';
import { ToolResolver } from './tool.resolver';
import { ToolService } from './tool.service';

@Module({
  providers: [
    ToolResolver,
    ToolLoader,
    ToolService,
    splitDb(Neo4jRepository, {
      gel: GelRepository,
      // migration-todo: remove `as any` once splitDb types accept drizzle repos directly
      postgres: ToolDrizzleRepository as any,
    }),
  ],
  exports: [ToolService, Neo4jRepository],
})
export class ToolCoreModule {}
