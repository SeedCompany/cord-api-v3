import { Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import {
  CalendarDate,
  DateInterval,
  ID,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
import {
  PeriodicReportService,
  ReportType,
  ScopedRole,
} from '../periodic-report';
import { QuestionAnswer } from '../question-answer';
import { NarrativeReport, NarrativeReportStatus as Status } from './dto';
import { NarrativeReportRepository } from './narrative-report.repository';

@Injectable()
export class NarrativeReportService {
  private readonly answerers: ScopedRole[] = [
    // TODO "Answerer" role
    'global:Administrator',
  ];
  private readonly reviewers: ScopedRole[] = [
    'project:ProjectManager',
    'project:RegionalDirector',
    'project:FieldOperationsDirector',
    'global:Administrator',
  ];

  constructor(
    private readonly repo: NarrativeReportRepository,
    private readonly auth: AuthorizationService,
    private readonly files: FileService,
    private readonly periodicReports: PeriodicReportService
  ) {}

  async getQuestionPerms(report: NarrativeReport, session: Session) {
    // Our auth system cannot currently express workflow, so we'll determine
    // edibility ourselves below.
    const {
      questions: { canRead },
    } = await this.auth.getPermissions({
      resource: NarrativeReport,
      dto: report,
      sessionOrUserId: session,
    });

    const roles = [...report.scope, ...session.roles];
    const isAnswerer = intersection(this.answerers, roles).length > 0;
    const isReviewer = intersection(this.reviewers, roles).length > 0;

    const canAddRemove = isAnswerer && report.status === Status.Draft;
    const canEdit =
      (isAnswerer && report.status === Status.Draft) ||
      (isReviewer && report.status === Status.InReview);

    return {
      canRead,
      canCreate: canAddRemove,
      secure: (dto: UnsecuredDto<QuestionAnswer>): QuestionAnswer => ({
        ...dto,
        answer: {
          canRead,
          canEdit,
          value: canRead ? dto.answer : undefined,
        },
        media: {
          canRead,
          canEdit,
          value: canRead ? dto.media : undefined,
        },
        canDelete: canAddRemove,
      }),
    };
  }

  async create(engagementId: ID, interval: DateInterval, session: Session) {
    try {
      const { id, reportFileId } = await this.repo.create(
        engagementId,
        interval
      );

      await this.files.createDefinedFile(
        reportFileId,
        interval.end.toISODate(),
        session,
        id,
        'reportFile'
      );

      return await this.periodicReports.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create narrative report', exception);
    }
  }

  async delete(engagementId: ID, range: DateInterval[]) {
    await this.periodicReports.delete(
      engagementId,
      ReportType.Narrative,
      range
    );
  }

  async mergeFinalReport(id: ID, at: CalendarDate, session: Session) {
    await this.periodicReports.mergeFinalReport(
      id,
      ReportType.Narrative,
      at,
      session
    );
  }
}
