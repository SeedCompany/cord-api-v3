import { Injectable } from '@nestjs/common';
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
import { PeriodicReportService, ReportType } from '../periodic-report';
import { QuestionAnswer } from '../question-answer';
import { NarrativeReport } from './dto';
import { NarrativeReportRepository } from './narrative-report.repository';

@Injectable()
export class NarrativeReportService {
  constructor(
    private readonly repo: NarrativeReportRepository,
    private readonly auth: AuthorizationService,
    private readonly files: FileService,
    private readonly periodicReports: PeriodicReportService
  ) {}

  async getQuestionPerms(report: NarrativeReport, session: Session) {
    const { questions: perms } = await this.auth.getPermissions({
      resource: NarrativeReport,
      dto: report,
      sessionOrUserId: session,
    });
    // TODO Need report & user roles to determine editability in workflow.
    return {
      ...perms,
      canCreate: perms.canEdit,
      secure: (dto: UnsecuredDto<QuestionAnswer>): QuestionAnswer => ({
        ...dto,
        answer: {
          ...perms,
          value: perms.canRead ? dto.answer : undefined,
        },
        media: {
          ...perms,
          value: perms.canRead ? dto.media : undefined,
        },
        canDelete: perms.canEdit,
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
