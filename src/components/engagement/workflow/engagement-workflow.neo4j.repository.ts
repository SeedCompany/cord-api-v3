import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  Order,
  PublicOf,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  INACTIVE,
  merge,
  requestingUser,
  sorting,
} from '~/core/database/query';
import { ProjectStep } from '../../project/dto';
import { EngagementStatus, IEngagement } from '../dto';
import {
  ExecuteEngagementTransitionInput,
  EngagementWorkflowEvent as WorkflowEvent,
} from './dto';
import { EngagementWorkflowRepository } from './engagement-workflow.repository';

@Injectable()
export class EngagementWorkflowNeo4jRepository
  extends DtoRepository(WorkflowEvent)
  implements PublicOf<EngagementWorkflowRepository>
{
  // @ts-expect-error It doesn't have match base signature
  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'node.id': inArray(ids) })
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list(engagementId: ID, session: Session) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'engagement.id': engagementId })
      .match(requestingUser(session))
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(sorting(WorkflowEvent, { sort: 'createdAt', order: Order.ASC }))
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected matchEvent() {
    return (query: Query) =>
      query.match([
        node('node', this.resource.dbLabel),
        relation('in', '', ACTIVE),
        node('engagement', 'Engagement'),
      ]);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('engagement', 'Engagement'),
          relation('out', '', 'workflowEvent', ACTIVE),
          node('node'),
          relation('out', undefined, 'who'),
          node('who', 'Actor'),
        ])
        .return<{ dto: UnsecuredDto<WorkflowEvent> }>(
          merge('node', {
            at: 'node.createdAt',
            who: 'who { .id }',
            engagement: 'engagement { .id }',
          }).as('dto'),
        );
  }

  async recordEvent(
    {
      engagement,
      ...props
    }: Omit<ExecuteEngagementTransitionInput, 'bypassTo'> & {
      to: EngagementStatus;
    },
    session: Session,
  ) {
    const result = await this.db
      .query()
      .apply(
        await createNode(WorkflowEvent, {
          baseNodeProps: props,
        }),
      )
      .apply(
        createRelationships(WorkflowEvent, {
          in: { workflowEvent: ['Engagement', engagement] },
          out: { who: ['Actor', session.userId] },
        }),
      )
      .apply(this.hydrate())
      .first();
    const event = result!.dto;

    await this.db.updateProperties({
      type: IEngagement,
      object: { id: engagement },
      changes: { status: event.to, statusModifiedAt: event.at },
      permanentAfter: null,
    });

    return event;
  }

  async mostRecentStep(
    engagementId: ID<'Engagement'>,
    steps: readonly EngagementStatus[],
  ) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Engagement', { id: engagementId }),
        relation('out', '', 'status', INACTIVE),
        node('prop'),
      ])
      .where({ 'prop.value': inArray(steps) })
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ step: EngagementStatus }>(`prop.value as step`)
      .first();
    return result?.step ?? null;
  }

  async getCurrentProjectStep(engagementId: ID, changeset?: ID) {
    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('in', '', 'engagement'), // Removed active true due to changeset aware
        node('project', 'Project'),
      ])
      .raw('return project.id as projectId')
      .asResult<{ projectId: ID }>()
      .first();

    if (!result?.projectId) {
      throw new ServerException(`Could not find project`);
    }
    const projectId = result.projectId;

    let currentStep;
    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id: projectId }),
          relation('out', '', 'step', INACTIVE),
          node('step', 'Property'),
          relation('in', '', 'changeset', ACTIVE),
          node('', 'Changeset', { id: changeset }),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }
    if (!currentStep) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id: projectId }),
          relation('out', '', 'step', ACTIVE),
          node('step', 'Property'),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }

    if (!currentStep) {
      throw new ServerException(`Could not find project's step`);
    }

    return currentStep;
  }
}
