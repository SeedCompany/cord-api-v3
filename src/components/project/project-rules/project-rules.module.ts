import { Module } from '@nestjs/common';
import { splitDb2 } from '~/core';
import { ProjectRulesNeo4jRepository } from './project.rules.neo4j.repository';
import { ProjectRulesRepository } from './project.rules.repository';

@Module({
  providers: [
    splitDb2(ProjectRulesRepository, {
      edge: ProjectRulesRepository,
      neo4j: ProjectRulesNeo4jRepository,
    }),
  ],
  exports: [ProjectRulesRepository],
})
export class ProjectRulesModule {}
