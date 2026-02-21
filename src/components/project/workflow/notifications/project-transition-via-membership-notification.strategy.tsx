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
import { ProjectTransitionViaMembershipNotification } from './project-transition-via-membership-notification.dto';

@NotificationStrategy(ProjectTransitionViaMembershipNotification)
export class ProjectTransitionViaMembershipNotificationStrategy extends INotificationStrategy<ProjectTransitionViaMembershipNotification> {
  getDescription() {
    return 'When a project you are a member of transitions to a new step';
  }

  insertForGel(input: InputOf<ProjectTransitionViaMembershipNotification>) {
    return e.insert(e.Notification.ProjectTransitionViaMembership, {
      workflowEvent: e.cast(
        e.Project.WorkflowEvent,
        e.uuid(input.workflowEvent),
      ),
      previousStep: e.cast(e.Project.Step, input.previousStep),
    });
  }

  saveForNeo4j(input: InputOf<ProjectTransitionViaMembershipNotification>) {
    return (query: Query) =>
      query.apply(
        createRelationships(ProjectTransitionViaMembershipNotification, 'out', {
          workflowEvent: ['ProjectWorkflowEvent', input.workflowEvent],
        }),
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

  renderEmail(notification: ProjectTransitionViaMembershipNotification) {
    return EmailMessage.from(
      <ProjectStepChangedNotification
        workflowEventId={notification.workflowEvent.id}
        previousStep={notification.previousStep}
      />,
    );
  }
}
