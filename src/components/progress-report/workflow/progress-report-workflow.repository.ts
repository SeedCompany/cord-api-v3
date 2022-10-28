import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Order, Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  merge,
  requestingUser,
  sorting,
} from '~/core/database/query';
import { ProgressReport, ProgressReportStatus as Status } from '../dto';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';
import { InternalTransition } from './transitions';

@Injectable()
export class ProgressReportWorkflowRepository extends DtoRepository(
  WorkflowEvent
) {
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

  async list(reportId: ID, session: Session) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'report.id': reportId })
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
        node('report', 'ProgressReport'),
        relation('in', '', ACTIVE),
        node('', 'Engagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('project', 'Project'),
      ]);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('out', undefined, 'who'),
          node('who', 'User'),
        ])
        .return<{ dto: UnsecuredDto<WorkflowEvent> }>(
          merge('node', {
            at: 'node.createdAt',
            who: 'who.id',
          }).as('dto')
        );
  }

  async recordTransition(
    report: ID,
    { id: transition, to: status }: InternalTransition,
    session: Session
  ) {
    await this.recordEvent(report, { status, transition }, session);
  }

  async recordBypass(report: ID, status: Status, session: Session) {
    await this.recordEvent(report, { status }, session);
  }

  private async recordEvent(
    report: ID,
    props: Record<string, any>,
    session: Session
  ) {
    await this.db
      .query()
      .apply(
        await createNode(WorkflowEvent, {
          baseNodeProps: props,
        })
      )
      .apply(
        createRelationships(WorkflowEvent, {
          in: { workflowEvent: ['ProgressReport', report] },
          out: { who: ['User', session.userId] },
        })
      )
      .return('*')
      .run();
  }

  async currentStatus(reportId: ID): Promise<Status> {
    const res = await this.db
      .query()
      .match(node('report', 'ProgressReport', { id: reportId }))
      .optionalMatch([
        node('report'),
        relation('out', undefined, 'status'),
        node('status', 'Property'),
      ])
      .return<{ status?: Status }>('status.value as status')
      .first();
    if (!res) {
      throw new NotFoundException('Could not find report', 'reportId');
    }
    if (!res.status) {
      throw new NotFoundException('Could not find report status');
    }
    return res.status;
  }

  async changeStatus(report: ID, status: Status) {
    await this.db.updateProperties({
      type: ProgressReport,
      object: { id: report },
      changes: { status },
    });
  }
}
