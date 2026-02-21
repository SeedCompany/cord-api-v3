import { node, type Query, relation } from 'cypher-query-builder';
import { EmailMessage } from '~/core/email';
import { e } from '~/core/gel';
import { createRelationships, exp } from '~/core/neo4j/query';
import {
  INotificationStrategy,
  type InputOf,
  NotificationStrategy,
} from '../../../notifications';
import { ProjectStepChangedNotification } from '../emails/project-step-changed-notification.email';
import { ProjectTransitionRequiringFinancialApprovalNotification } from './project-transition-requiring-financial-approval-notification.dto';

@NotificationStrategy(ProjectTransitionRequiringFinancialApprovalNotification)
export class ProjectTransitionRequiringFinancialApprovalNotificationStrategy extends INotificationStrategy<ProjectTransitionRequiringFinancialApprovalNotification> {
  getDescription() {
    return 'When a project transitions to a step requiring financial approval';
  }

  insertForGel(
    input: InputOf<ProjectTransitionRequiringFinancialApprovalNotification>,
  ) {
    return e.insert(
      e.Notification.ProjectTransitionRequiringFinancialApproval,
      {
        workflowEvent: e.cast(
          e.Project.WorkflowEvent,
          e.uuid(input.workflowEvent),
        ),
        previousStep: e.cast(e.Project.Step, input.previousStep),
      },
    );
  }

  saveForNeo4j(
    input: InputOf<ProjectTransitionRequiringFinancialApprovalNotification>,
  ) {
    return (query: Query) =>
      query.apply(
        createRelationships(
          ProjectTransitionRequiringFinancialApprovalNotification,
          'out',
          {
            workflowEvent: ['ProjectWorkflowEvent', input.workflowEvent],
          },
        ),
      );
  }

  hydrateExtraForNeo4j(outVar: string) {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('out', '', 'workflowEvent'),
          node('workflowEvent', 'ProjectWorkflowEvent'),
        ])
        .return(
          exp({
            workflowEvent: 'workflowEvent { .id }',
          }).as(outVar),
        );
  }

  renderEmail(
    notification: ProjectTransitionRequiringFinancialApprovalNotification,
  ) {
    return EmailMessage.from(
      <ProjectStepChangedNotification
        workflowEventId={notification.workflowEvent.id}
        previousStep={notification.previousStep}
      />,
    );
  }
}
