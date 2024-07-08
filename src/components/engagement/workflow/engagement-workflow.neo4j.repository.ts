import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID, Order, PublicOf, Session, UnsecuredDto } from '~/common';
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
}
