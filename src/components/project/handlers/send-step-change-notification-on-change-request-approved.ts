import { EmailService } from '@seedcompany/nestjs-email';
import { node, relation } from 'cypher-query-builder';
import { ID } from '../../../common';
import {
  ConfigService,
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE, INACTIVE } from '../../../core/database/query';
import { ProjectStepChanged } from '../../../core/email/templates';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';
import { ProjectStep } from '../dto';
import { ProjectRules } from '../project.rules';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class SendStepChangeNotificationsOnChangeRequestApproved
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly projectRules: ProjectRules,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    @Logger('project:change-request:approved')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('After approved changeset');

    const changesetId = event.changeRequest.id;

    // Need to send notifications when the project step is changed after applying changeset
    const result = await this.db
      .query()
      .match([
        node('node', 'Project'),
        relation('out', '', 'changeset', ACTIVE),
        node('changeset', 'Changeset', { id: changesetId }),
      ])
      .match([
        node('node'),
        relation('out', '', 'step', ACTIVE),
        node('currentStep', 'Property'),
      ])
      .match([
        node('node'),
        relation('out', '', 'step', INACTIVE),
        node('previousStep', 'Property'),
      ])
      .with('node, currentStep, previousStep')
      .orderBy('previousStep.createdAt', 'DESC')
      .return<{
        projectId: ID;
        currentStep: ProjectStep;
        previousStep: ProjectStep;
      }>(
        'node.id as projectId, currentStep.value as currentStep, collect(previousStep.value)[0] as previousStep'
      )
      .first();

    if (
      !result ||
      result.currentStep === result.previousStep ||
      !this.config.email.notifyProjectStepChanges
    ) {
      return;
    }

    const recipients = await this.projectRules.getNotifications(
      result.projectId,
      result.currentStep,
      event.session.userId,
      result.previousStep
    );

    this.logger.info('Notifying', {
      emails: recipients.map((r) => r.recipient.email.value),
      projectId: result.projectId,
      step: result.currentStep,
      previousStep: result.previousStep,
    });

    for (const notification of recipients) {
      if (!notification.recipient.email.value) {
        continue;
      }
      await this.emailService.send(
        notification.recipient.email.value,
        ProjectStepChanged,
        notification
      );
    }
  }
}
