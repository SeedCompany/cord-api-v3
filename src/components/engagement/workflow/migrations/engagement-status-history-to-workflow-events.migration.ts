import { ModuleRef } from '@nestjs/core';
import { node, relation } from 'cypher-query-builder';
import { chunk } from 'lodash';
import { DateTime } from 'luxon';
<<<<<<< HEAD
import { ID } from '~/common';
=======
import { Disabled, ID } from '~/common';
>>>>>>> f308f17e6 (Engagement Workflow v2)
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, variable } from '~/core/database/query';
import { SystemAgentRepository } from '../../../user/system-agent.repository';
import { Engagement, EngagementStatus } from '../../dto';
import { EngagementWorkflowRepository } from '../engagement-workflow.repository';
import { EngagementWorkflowService } from '../engagement-workflow.service';

@Migration('2024-07-05T09:00:02')
export class EngagementStatusHistoryToWorkflowEventsMigration extends BaseMigration {
  constructor(
    private readonly agents: SystemAgentRepository,
    private readonly workflow: EngagementWorkflowService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async up() {
    const ghost = await this.agents.getGhost();
    const engagements = await this.db
      .query()
      .match(node('engagement', 'Engagement'))
      .match(node('ghost', 'Actor', { id: ghost.id }))
      .subQuery('engagement', (sub) =>
        sub
          .match([
            node('engagement', 'Engagement'),
            relation('out', '', 'status'),
            node('status'),
          ])
          .with('status')
          .orderBy('status.createdAt', 'asc')
          .return('collect(apoc.convert.toMap(status)) as steps'),
      )
      .with('engagement, steps')
      .raw('where size(steps) > 1')
      .return<{
        engagement: { id: ID };
        steps: ReadonlyArray<{ value: EngagementStatus; createdAt: DateTime }>;
      }>('apoc.convert.toMap(engagement) as engagement, steps')
      .run();
    this.logger.notice(
      `Found ${engagements.length} engagements to add event history to.`,
    );

    const events: Array<
      Parameters<EngagementWorkflowRepository['recordEvent']>[0] & {
        at: DateTime;
      }
    > = [];

    for (const [i, { engagement, steps }] of engagements.entries()) {
      if (i % 100 === 0) {
        this.logger.notice(
          `Processing engagement ${i + 1}/${engagements.length}`,
        );
      }

      for (const [i, next] of steps.entries()) {
        if (i === 0) {
          continue;
        }
        const current = steps[i - 1]!;
        const prev = steps
          .slice(0, Math.max(0, i - 2))
          .map((s) => s.value)
          .reverse();
        const fakeEngagement: Engagement = {
          id: engagement.id,
          step: { value: current.value, canRead: true, canEdit: true },
        } as any;
        // @ts-expect-error private but this is a migration
        const transitions = await this.workflow.resolveAvailable(
          current.value,
          {
            engagement: fakeEngagement,
            moduleRef: this.moduleRef,
<<<<<<< HEAD
            migrationPrevStates: prev,
=======
            migrationPrevSteps: prev,
>>>>>>> f308f17e6 (Engagement Workflow v2)
          },
          engagement,
          // We don't know who did it, so we can't confirm this was an official
          // transition instead of a bypass.
          // Guess that it was if a transition exists.
          this.fakeAdminSession,
        );

        const transition = transitions.find((t) => t.to === next.value)?.key;

        events.push({
          engagement: engagement.id,
          to: next.value,
          transition,
          at: next.createdAt,
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
        .match(
          node('engagement', 'Engagement', {
            id: variable('input.engagement'),
          }),
        )
        .create([
          node('engagement'),
          relation('out', '', 'workflowEvent', {
            ...ACTIVE,
            createdAt: variable('input.at'),
          }),
          node('event', ['EngagementWorkflowEvent', 'BaseNode'], {
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
