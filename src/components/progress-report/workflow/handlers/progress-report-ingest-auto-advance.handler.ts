import { RichTextDocument, ServerException } from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { SystemAgentRepository } from '../../../user/system-agent.repository';
import {
  IngestTriggers,
  ProgressReportIngestTriggerHook,
} from '../hooks/ingest-trigger.hook';
import { ProgressReportWorkflowService } from '../progress-report-workflow.service';
import { Transitions } from '../transitions';

/**
 * Advances a progress report's status when an ingest trigger fires —
 * e.g. NotStarted -> InProgress when Rev79 delivers report data.
 *
 * Never regresses: the transition only fires when it is available from the
 * report's current status, and ingest triggers may only map to transitions
 * with a `from` status — so a report that is already further along is never
 * touched, and a repeated delivery changes nothing.
 *
 * The transition executes as the "Rev79" system agent, which is the recorded
 * actor on the workflow event and in the notification email. The delivery
 * itself is the authorization — the caller already needed write access to the
 * report to get here.
 */
@OnHook(ProgressReportIngestTriggerHook)
export class ProgressReportIngestAutoAdvanceHandler {
  constructor(
    private readonly workflow: ProgressReportWorkflowService,
    private readonly agents: SystemAgentRepository,
    private readonly identity: Identity,
    private readonly config: ConfigService,
    @Logger('progress-report:auto-advance') private readonly logger: ILogger,
  ) {}

  async handle({ reportId, trigger, source }: ProgressReportIngestTriggerHook) {
    if (this.config.databaseEngine === 'gel') {
      // migration-todo: the Gel schema types workflow-event `who` as a User,
      // so an agent-actored event cannot be recorded there — skip rather than
      // fail the whole ingest. Drop with the Gel arm at Phase 7 cutover.
      this.logger.info(
        'Skipping auto-advance; Gel cannot record agent actors',
        { report: reportId, trigger },
      );
      return;
    }

    const { transition: transitionName, description } = IngestTriggers[trigger];
    const transition = Transitions[transitionName];
    if (!transition.from) {
      // A from-less transition is available from EVERY status, so a repeated
      // delivery would re-execute it and could regress a later status.
      throw new ServerException(
        `Ingest trigger "${trigger}" must map to a transition with a "from" status`,
      );
    }

    const reason = `${description} from ${source}`;
    // The actor is the Rev79 agent for every trigger that exists today; a
    // future non-Rev79 source needs its own agent decided here deliberately.
    const agent = await this.agents.getRev79();
    const advanced = await this.identity.asSystemAgent(
      agent,
      async () =>
        await this.workflow.executeTransitionIfAvailable(
          {
            report: reportId,
            transition: transition.id,
            notes: RichTextDocument.fromText(`Automated: ${reason}.`),
          },
          reason,
        ),
    );

    if (!advanced) {
      this.logger.debug('Report is already past this trigger', {
        report: reportId,
        trigger,
      });
      return;
    }
    this.logger.info('Auto-advanced progress report', {
      report: reportId,
      trigger,
      transition: transition.name,
      to: transition.to,
    });
  }
}
