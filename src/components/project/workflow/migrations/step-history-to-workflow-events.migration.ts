import { ModuleRef } from '@nestjs/core';
import { node, relation } from 'cypher-query-builder';
import { chunk } from 'lodash';
import { DateTime } from 'luxon';
import { ID } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, variable } from '~/core/database/query';
import { SystemAgentRepository } from '../../../user/system-agent.repository';
import { Project, ProjectStep, ProjectType } from '../../dto';
import { ProjectWorkflowRepository } from '../project-workflow.repository';
import { ProjectWorkflowService } from '../project-workflow.service';

@Migration('2024-06-22T09:00:00')
export class StepHistoryToWorkflowEventsMigration extends BaseMigration {
  constructor(
    private readonly agents: SystemAgentRepository,
    private readonly workflow: ProjectWorkflowService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async up() {
    const ghost = await this.agents.getGhost();
    const projects = await this.db
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
          .with('step')
          .orderBy('step.createdAt', 'asc')
          .return('collect(apoc.convert.toMap(step)) as steps'),
      )
      .with('project, steps')
      .raw('where size(steps) > 1')
      .return<{
        project: { id: ID; type: ProjectType };
        steps: ReadonlyArray<{ value: ProjectStep; createdAt: DateTime }>;
      }>('apoc.convert.toMap(project) as project, steps')
      .run();
    this.logger.notice(
      `Found ${projects.length} projects to add event history to.`,
    );

    const events: Array<
      Parameters<ProjectWorkflowRepository['recordEvent']>[0] & { at: DateTime }
    > = [];

    for (const [i, { project, steps }] of projects.entries()) {
      if (i % 100 === 0) {
        this.logger.notice(`Processing project ${i + 1}/${projects.length}`);
      }

      for (const [i, step] of steps.entries()) {
        if (i === 0) {
          continue;
        }
        const prev = steps[i - 1]!;
        const fakeProject: Project = {
          id: project.id,
          type: project.type,
          step: { value: step.value, canRead: true, canEdit: true },
        } as any;
        // @ts-expect-error private but this is a migration
        const transitions = await this.workflow.resolveAvailable(
          step.value,
          {
            project: fakeProject,
            moduleRef: this.moduleRef,
            migrationPrevStep: prev.value,
          },
          project,
          // We don't know who did it, so we can't confirm this was an official
          // transition instead of a bypass.
          // Guess that it was if a transition exists.
          this.fakeAdminSession,
        );

        const transition = transitions.find((t) => t.to === step.value)?.key;

        events.push({
          project: project.id,
          to: step.value,
          transition,
          at: step.createdAt,
        });
      }
    }

    const transitionsCount = events.filter((e) => e.transition).length;
    this.logger.notice(`Resolved events to save`, {
      events: events.length,
      transitions: transitionsCount,
      bypasses: events.length - transitionsCount,
    });

    for (const [i, someEvents] of chunk(events, 1000).entries()) {
      this.logger.notice(`Saving events ${i + 1}k`);

      const query = this.db
        .query()
        .match(node('ghost', 'Actor', { id: ghost.id }))
        .unwind(someEvents, 'input')
        .match(node('project', 'Project', { id: variable('input.project') }))
        .create([
          node('project'),
          relation('out', '', 'workflowEvent', {
            ...ACTIVE,
            createdAt: variable('input.at'),
          }),
          node('event', ['ProjectWorkflowEvent', 'BaseNode'], {
            id: variable('apoc.create.uuid()'),
            createdAt: variable('input.at'),
            to: variable('input.to'),
            transition: variable('input.transition'),
            notes: null,
            migrated: true,
          }),
          relation('out', '', 'who', {
            ...ACTIVE,
            createdAt: variable('input.at'),
          }),
          node('ghost'),
        ])
        .return('count(event) as event');
      await query.executeAndLogStats();
    }
  }
}
