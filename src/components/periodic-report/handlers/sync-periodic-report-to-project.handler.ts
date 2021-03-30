import { node, relation } from 'cypher-query-builder';
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
import { CreatePeriodicReport } from '../dto';
import { ReportType } from '../dto/type.enum';
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

    await this.syncRecords(project, event.session);
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
