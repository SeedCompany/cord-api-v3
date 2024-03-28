import { Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  PublicOf,
  Session,
  UnsecuredDto,
} from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { ProgressReportStatus as Status } from '../dto';
import { ProgressReportWorkflowEvent } from './dto/workflow-event.dto';
import { ProgressReportWorkflowRepository } from './progress-report-workflow.repository';

@Injectable()
export class ProgressReportWorkflowEdgeDBRepository
  extends RepoFor(ProgressReportWorkflowEvent, {
    hydrate: (event) => ({
      ...event['*'],
      report: true,
      who: true,
      transition: event.transitionId,
    }),
  }).customize((cls, { defaults }) => {
    return class extends cls {
      static omit = [defaults.create, defaults.update, defaults.delete];
      async list(
        reportId: ID,
        _session: Session,
      ): Promise<Array<UnsecuredDto<ProgressReportWorkflowEvent>>> {
        const query = e.select(e.ProgressReport, () => ({
          filter_single: { id: reportId },
          workflowEvents: {
            id: true,
            at: true,
            status: true,
            transitionId: true,
            notes: true,
            who: {
              id: true,
              email: true,
            },
          },
        }));
        const results = await this.db.run(query);
        if (!results) {
          throw new NotFoundException('Could not find report', 'reportId');
        }
        if (!results.workflowEvents) {
          throw new NotFoundException(
            'Could not find workflow events for report',
            'reportId',
          );
        }
        return results.workflowEvents.map((event) => ({
          id: event.id,
          at: event.at,
          status: event.status,
          transition: event.transitionId,
          notes: event.notes,
          who: {
            id: event.who.id,
            email: event.who.email,
          },
        }));
      }
    };
  })
  implements PublicOf<ProgressReportWorkflowRepository>
{
  async recordEvent(report: ID, props: Record<string, any>, _session: Session) {
    const query = e.select(
      e.insert(e.ProgressReport.WorkflowEvent, {
        report: e.select(e.ProgressReport, () => ({
          filter_single: { id: report },
        })),
        transitionId: props.transition,
        status: props.status,
        notes: props.notes,
      }),
      this.hydrate,
    );
    return await this.db.run(query);
  }

  async currentStatus(reportId: ID): Promise<Status> {
    const query = e.select(e.ProgressReport, () => ({
      filter_single: { id: reportId },
      status: true,
    }));
    const report = await this.db.run(query);
    if (!report) {
      throw new NotFoundException('Could not find report', 'reportId');
    }
    if (!report.status) {
      throw new NotFoundException('Could not find report status');
    }
    return report?.status;
  }

  async changeStatus(report: ID, status: Status) {
    const query = e.update(e.ProgressReport.WorkflowEvent, () => ({
      filter_single: { id: report },
      set: { status: status },
    }));
    await this.db.run(query);
  }

  async getProjectMemberInfoByReportId(reportId: ID) {
    const query = e.select(e.ProgressReport, () => ({
      filter_single: { id: reportId },
      project: {
        members: {
          user: {
            id: true,
            email: true,
            roles: true,
          },
        },
      },
    }));
    const results = await this.db.run(query);
    if (!results) {
      throw new NotFoundException('Could not find report', 'reportId');
    }
    return results.project.members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      roles: member.user.roles.map((role) => role),
    }));
  }

  async getUserIdByEmails(emails: readonly string[]) {
    const query = e.params({ emails: e.array(e.str) }, ({ emails }) =>
      e.select(e.User, (user) => ({
        filter: e.op(user.email, 'in', e.array_unpack(emails)),
        id: true,
        email: true,
      })),
    );
    const result = await this.db.run(query, { emails });
    return result.map((user) => ({ id: user.id, email: user.email }));
  }

  async getProjectInfoByReportId(reportId: ID) {
    const query = e.select(e.ProgressReport, () => ({
      filter_single: { id: reportId },
      project: {
        id: true,
      },
      engagement: {
        language: {
          id: true,
        },
      },
    }));
    const result = await this.db.run(query);
    if (!result) {
      throw new NotFoundException('Could not find report', 'reportId');
    }
    return {
      projectId: result.project.id,
      languageId: result.engagement.language.id,
    };
  }
}
