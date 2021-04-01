import { isNull, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Session } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { Project } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { CreatePeriodicReport, ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportToProject
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly periodicReports: PeriodicReportService,
    @Logger('periodicReport:sync-project') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const project = event.updated;
    const previous = event.previous;

    const isDateRangeChanged =
      project.mouStart !== previous.mouStart ||
      project.mouEnd !== previous.mouEnd;

    if (isDateRangeChanged) {
      await this.removeOldReports(project, event.session);
      await this.syncRecords(project, event.session);
    }
  }

  private async removeOldReports(project: Project, session: Session) {
    const reports = await this.db
      .query()
      .match([
        node('project', 'Project', { id: project.id }),
        relation('out', '', 'report', { active: true }),
        node('report', 'PeriodicReport'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', 'rel', 'reportFile', { active: true }),
        node('file', 'File'),
      ])
      .with('report, rel')
      .where({ rel: isNull() })
      .return('report.id as reportId')
      .asResult<{ reportId: string }>()
      .run();

    await Promise.all(
      reports.map((report) =>
        this.periodicReports.delete(report.reportId, session)
      )
    );
  }

  private async syncRecords(project: Project, session: Session) {
    await this.addReport(
      project.id,
      {
        start: project.mouStart.value!,
        end: project.mouEnd.value!,
        type: ReportType.Financial,
      },
      session
    );

    await this.addReport(
      project.id,
      {
        start: project.mouStart.value!,
        end: project.mouEnd.value!,
        type: ReportType.Narrative,
      },
      session
    );
  }

  private async addReport(
    projectId: string,
    input: CreatePeriodicReport,
    session: Session
  ) {
    const report = await this.periodicReports.create(input, session);
    await this.db
      .query()
      .match(node('project', 'Project', { id: projectId }))
      .match(node('periodicReport', 'PeriodicReport', { id: report.id }))
      .create([
        node('project'),
        relation('out', '', 'report', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('periodicReport'),
      ])
      .run();
  }
}
