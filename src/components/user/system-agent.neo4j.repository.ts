import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, Role } from '~/common';
import { DatabaseService } from '~/core/database';
import { SystemAgentRepository } from './system-agent.repository';

@Injectable()
export class SystemAgentNeo4jRepository extends SystemAgentRepository {
  constructor(private readonly db: DatabaseService) {
    super();
  }

  protected async upsertAgent(name: string, roles?: readonly Role[]) {
    const res = await this.db
      .query()
      .merge(node('agent', ['SystemAgent', 'Actor'], { name }))
      .onCreate.set({
        variables: {
          'agent.id': 'apoc.create.uuid()',
        },
        values: {
          'agent.roles': roles ?? [],
        },
      })
      .return<{ agent: { id: ID; name: string; roles: readonly Role[] } }>(
        'apoc.convert.toMap(agent) AS agent',
      )
      .first();
    return res!.agent;
  }
}
