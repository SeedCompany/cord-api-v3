import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
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
    splitDb(Neo4jRepository, GelRepository),
  ],
  exports: [ToolService],
})
export class ToolCoreModule {}
