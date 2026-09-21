import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { type Role } from '~/common';
import { DatabaseService } from '~/core/neo4j';
import { merge } from '~/core/neo4j/query';
import { type SystemAgent } from './dto';
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
      })
      // On match too — the Drizzle arm updates roles on conflict, and a roles
      // change in a getter must land the same way on both engines.
      .setValues({ 'agent.roles': roles ?? [] })
      .return<{ agent: SystemAgent }>(
        merge('agent', { __typename: '"SystemAgent"' }).as('agent'),
      )
      .first();
    return res!.agent;
  }
}
