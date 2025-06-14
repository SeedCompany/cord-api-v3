import { Injectable } from '@nestjs/common';
import { inArray, node, type Query, relation } from 'cypher-query-builder';
import { type SetRequired } from 'type-fest';
import {
  type ID,
  NotFoundException,
  Order,
  type Role,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  merge,
  path,
  sorting,
} from '~/core/database/query';
import { ProgressReport, type ProgressReportStatus as Status } from '../dto';
import { type ExecuteProgressReportTransitionInput } from './dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';

@Injectable()
export class ProgressReportWorkflowRepository extends DtoRepository(
  WorkflowEvent,
) {
  async readMany(ids: readonly ID[]) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'node.id': inArray(ids) })
      .apply(this.privileges.filterToReadable())
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list(reportId: ID) {
    return await this.db
      .query()
      .apply(this.matchEvent())
      .where({ 'report.id': reportId })
      .with('*') // needed between where & where
      .apply(this.privileges.filterToReadable())
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
            who: 'who { .id }',
          }).as('dto'),
        );
  }

  async recordEvent({
    report,
    ...props
  }: SetRequired<ExecuteProgressReportTransitionInput, 'status'>) {
    const result = await this.db
      .query()
      .apply(
        await createNode(WorkflowEvent, {
          baseNodeProps: props,
        }),
      )
      .apply(
        createRelationships(WorkflowEvent, {
          in: { workflowEvent: ['ProgressReport', report] },
          out: { who: currentUser },
        }),
      )
      .apply(this.hydrate())
      .first();
    return result!.dto;
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

  async getProjectMemberInfoByReportId(reportId: ID) {
    const query = this.db
      .query()
      .match([
        node('', 'ProgressReport', { id: reportId }),
        relation('in', '', ACTIVE),
        node('', 'Engagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('', 'Project'),
        relation('out', '', 'member', ACTIVE),
        node('member', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .where(
        path([
          node('member'),
          relation('out', '', 'inactiveAt', ACTIVE),
          node('', 'Property', { value: null }),
        ]),
      )
      .match([
        node('user'),
        relation('out', '', 'email', ACTIVE),
        node('email', 'EmailAddress'),
      ])
      .match([
        node('member'),
        relation('out', '', 'roles', ACTIVE),
        node('role', 'Property'),
      ])
      .return<{
        id: ID;
        email: string;
        roles: readonly Role[];
      }>([
        'user.id as id',
        'email.value as email',
        'coalesce(role.value, []) as roles',
      ]);
    return await query.run();
  }

  async getUserIdByEmails(emails: readonly string[]) {
    const query = this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', ACTIVE),
        node('user', 'User'),
      ])
      .where({ 'email.value': inArray(emails) })
      .return<{
        id: ID;
        email: string;
      }>(['user.id as id, email.value as email']);
    return await query.run();
  }

  async getProjectInfoByReportId(reportId: ID) {
    const query = this.db
      .query()
      .match([
        node('report', 'ProgressReport', { id: reportId }),
        relation('in', '', ACTIVE),
        node('engagement', 'Engagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('project', 'Project'),
      ])
      .match([
        node('engagement'),
        relation('out', '', ACTIVE),
        node('language', 'Language'),
      ])
      .return<{
        projectId: ID;
        languageId: ID;
      }>(['project.id as projectId', 'language.id as languageId']);
    const result = await query.first();
    if (!result) {
      throw new ServerException(
        `Unable to retrieve project and language information for reportId ${reportId}`,
      );
    }
    return result;
  }
}
