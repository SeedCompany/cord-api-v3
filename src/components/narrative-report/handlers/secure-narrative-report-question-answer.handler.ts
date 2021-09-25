import { UnauthorizedException } from '../../../common';
import { EventsHandler, IEventHandler } from '../../../core';
import { PeriodicReportService } from '../../periodic-report';
import {
  AuthorizeQuestionAnswerCreationEvent,
  SecureQuestionAnswerEvent,
} from '../../question-answer/events';
import { NarrativeReport } from '../dto';
import { NarrativeReportService } from '../narrative-report.service';

type Event = SecureQuestionAnswerEvent | AuthorizeQuestionAnswerCreationEvent;

@EventsHandler(SecureQuestionAnswerEvent, AuthorizeQuestionAnswerCreationEvent)
export class SecureNarrativeReportQuestionAnswerHandler
  implements IEventHandler<Event>
{
  constructor(
    private readonly service: NarrativeReportService,
    private readonly reports: PeriodicReportService
  ) {}

  async handle(event: Event) {
    // We only handle Q/A's on Narrative Reports
    if (event.parent.__typename !== 'NarrativeReport') {
      return;
    }

    if (event instanceof AuthorizeQuestionAnswerCreationEvent) {
      const report = event.parent as NarrativeReport;
      const perms = await this.service.getQuestionPerms(report, event.session);
      if (!perms.canCreate) {
        throw new UnauthorizedException(
          'You cannot add question/answers to this report'
        );
      }

      event.markAllowed();
      return;
    }

    const report = (await this.reports.readOne(
      event.parent.id,
      event.session
    )) as NarrativeReport;
    const perms = await this.service.getQuestionPerms(report, event.session);
    event.secured = perms.secure(event.dto);
  }
}
