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
import { ProjectCreatedEvent, ProjectUpdatedEvent } from '../../project/events';
import { CreatePeriodicReport } from '../dto';
import { ReportType } from '../dto/type.enum';
import { PeriodicReportService } from '../periodic-report.service';

type SubscribedEvent = ProjectCreatedEvent | ProjectUpdatedEvent;

@EventsHandler(ProjectCreatedEvent, ProjectUpdatedEvent)
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

    const project = this.determineProject(event);

    await this.syncRecords(project, event.session);
  }

  private determineProject(event: SubscribedEvent) {
    if (event instanceof ProjectCreatedEvent) {
      return event.project;
    }
    return event.updated;
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
      .create([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'report', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('periodicReport', 'PeriodicReport', { id: report.id }),
      ])
      .run();
  }
}
