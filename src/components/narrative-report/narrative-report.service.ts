import { Injectable } from '@nestjs/common';
import { intersection } from 'lodash';
import {
  CalendarDate,
  DateInterval,
  ID,
  ServerException,
  Session,
  simpleSwitch,
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
  ];
  private readonly reviewers: ScopedRole[] = [
    'project:ProjectManager',
    'project:RegionalDirector',
    'project:FieldOperationsDirector',
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
      otherRoles: report.scope,
    });

    const roles = [...report.scope, ...session.roles];
    const isAnswerer = intersection(this.answerers, roles).length > 0;
    const isReviewer = intersection(this.reviewers, roles).length > 0;

    const isAdmin = session.roles.includes('global:Administrator');
    const canAddRemove =
      isAdmin || (isAnswerer && report.status.value === Status.Draft);
    const canEdit =
      isAdmin ||
      (isAnswerer && report.status.value === Status.Draft) ||
      (isReviewer && report.status.value === Status.InReview);

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

  async secure(
    dto: UnsecuredDto<NarrativeReport>,
    session: Session
  ): Promise<NarrativeReport> {
    const roles = [...dto.scope, ...session.roles];
    const isAnswerer = intersection(this.answerers, roles).length > 0;
    const isReviewer = intersection(this.reviewers, roles).length > 0;
    const isAdmin = session.roles.includes('global:Administrator');

    const canAdvance =
      (isAdmin && dto.status !== Status.Finalized) ||
      (isAnswerer && dto.status === Status.Draft) ||
      (isReviewer && dto.status === Status.InReview);

    // Our auth system cannot currently express workflow, so we'll determine
    // edibility ourselves above.
    const securedProps = await this.auth.secureProperties(
      NarrativeReport,
      dto,
      session,
      dto.scope
    );

    return {
      ...dto,
      ...securedProps,
      status: {
        ...securedProps.status,
        canEdit: canAdvance,
      },
      canDelete: false, // Auto generated, no user deleting.
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

  async advanceStatus(id: ID, session: Session) {
    const report = (await this.periodicReports.readOne(
      id,
      session
    )) as NarrativeReport;

    await this.auth.verifyCanEdit({
      resource: NarrativeReport,
      baseNode: report,
      prop: 'status',
    });

    const newStatus = simpleSwitch(report.status.value, {
      Draft: Status.InReview,
      InReview: Status.Finalized,
      Finalized: undefined,
    });

    if (newStatus) {
      await this.repo.updateProperties(report, { status: newStatus });
    }
  }
}
