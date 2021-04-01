import { isNull, node, relation } from 'cypher-query-builder';
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
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectUpdatedEvent;

@EventsHandler(ProjectUpdatedEvent)
export class SyncPeriodicReportsToProjectDateRange
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly periodicReports: PeriodicReportService,
    @Logger('periodic-reports:project-sync') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Project mutation, syncing periodic reports', {
      ...event,
      event: event.constructor.name,
    });

    const project = event.updated;
    const previous = event.previous;

    const isDateRangeChanged =
      +project.mouStart !== +previous.mouStart ||
      +project.mouEnd !== +previous.mouEnd;

    if (isDateRangeChanged) {
      await this.removeOldReports(previous, event.session);
      await this.addRecords(project, event.session);
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
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'end', { active: true }),
        node('end', 'Property'),
      ])
      .with('report, rel, start, end')
      .where({
        rel: isNull(),
        start: {
          value: project.mouStart.value,
        },
        end: {
          value: project.mouEnd.value,
        },
      })
      .return('report.id as reportId')
      .asResult<{ reportId: string }>()
      .run();

    await Promise.all(
      reports.map((report) =>
        this.periodicReports.delete(report.reportId, session)
      )
    );
  }

  private async addRecords(project: Project, session: Session) {
    await this.periodicReports.create(
      {
        start: project.mouStart.value!,
        end: project.mouEnd.value!,
        type: ReportType.Financial,
        projectOrEngagementId: project.id,
      },
      session
    );

    await this.periodicReports.create(
      {
        start: project.mouStart.value!,
        end: project.mouEnd.value!,
        type: ReportType.Narrative,
        projectOrEngagementId: project.id,
      },
      session
    );
  }
}
