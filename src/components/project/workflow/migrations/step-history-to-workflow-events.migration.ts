import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { variable } from '~/core/database/query';
import { SystemAgentRepository } from '../../../user/system-agent.repository';

@Migration('2024-06-07T13:00:00')
export class StepHistoryToWorkflowEventsMigration extends BaseMigration {
  constructor(private readonly agents: SystemAgentRepository) {
    super();
  }

  async up() {
    const ghost = await this.agents.getGhost();
    const query = this.db
      .query()
      .match(node('project', 'Project'))
      .match(node('ghost', 'Actor', { id: ghost.id }))
      .subQuery('project', (sub) =>
        sub
          .match([
            node('project', 'Project'),
            relation('out', '', 'step'),
            node('step'),
          ])
          .return('step')
          .orderBy('step.createdAt', 'asc')
          .skip(1),
      )
      .create([
        node('project'),
        relation('out', '', 'workflowEvent'),
        node('event', 'ProjectWorkflowEvent', {
          id: variable('apoc.create.uuid()'),
          at: variable('step.createdAt'),
          to: variable('step.value'),
          notes: null,
        }),
        relation('out', '', 'who'),
        node('ghost'),
      ])
      .return('count(event) as event');
    await query.executeAndLogStats();
  }
}
