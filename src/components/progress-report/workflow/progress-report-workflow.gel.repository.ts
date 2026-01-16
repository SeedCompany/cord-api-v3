import { Injectable } from '@nestjs/common';
import { type SetRequired } from 'type-fest';
import { type ID, type PublicOf } from '~/common';
import { e, edgeql, RepoFor } from '~/core/gel';
import { type ProgressReportStatus as Status } from '../dto';
import { type ExecuteProgressReportTransition } from './dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowEvent } from './dto/workflow-event.dto';
import { type ProgressReportWorkflowRepository } from './progress-report-workflow.repository';

@Injectable()
export class ProgressReportWorkflowGelRepository
  extends RepoFor(ProgressReportWorkflowEvent, {
    hydrate: (event) => ({
      ...event['*'],
      report: true,
      who: true,
      transition: event.transitionId,
    }),
    omit: ['list', 'create', 'update', 'delete'],
  })
  implements PublicOf<ProgressReportWorkflowRepository>
{
  async list(reportId: ID) {
    const progressReport = e.cast(e.ProgressReport, e.uuid(reportId));
    const query = e.select(progressReport.workflowEvents, this.hydrate);
    return await this.db.run(query);
  }

  async recordEvent({
    report,
    ...props
  }: SetRequired<ExecuteProgressReportTransition, 'status'>) {
    const query = e.select(
      e.insert(e.ProgressReport.WorkflowEvent, {
        report: e.cast(e.ProgressReport, e.uuid(report)),
        transitionId: props.transition,
        status: props.status,
        notes: props.notes,
      }),
      this.hydrate,
    );
    return await this.db.run(query);
  }

  async currentStatus(reportId: ID): Promise<Status> {
    const query = e.cast(e.ProgressReport, e.uuid(reportId)).status;
    return await this.db.run(query);
  }

  async changeStatus(_report: ID, _status: Status) {
    return;
  }

  async getProjectMemberInfoByReportId(reportId: ID) {
    const query = edgeql(`
      with report := <ProgressReport><uuid>$reportId,
      users := (select report.project.members.user filter exists .email)
      select users { id, email := assert_exists(.email), roles }
    `);
    return await this.db.run(query, { reportId });
  }

  async getUserIdByEmails(emails: readonly string[]) {
    const query = edgeql(`
      with emails := array_unpack(<array<str>>$emails),
      users := (select User filter .email in emails)
      select users { id, email := assert_exists(.email) }
    `);
    return await this.db.run(query, { emails });
  }

  async getProjectInfoByReportId(reportId: ID) {
    const progressReport = e.cast(e.ProgressReport, e.uuid(reportId));
    const query = e.select({
      projectId: progressReport.project.id,
      languageId: progressReport.engagement.language.id,
    });
    return await this.db.run(query);
  }
}
