import { node, type Query, relation } from 'cypher-query-builder';
import { EmailMessage } from '~/core/email';
import { e } from '~/core/gel';
import { createRelationships, exp } from '~/core/neo4j/query';
import {
  INotificationStrategy,
  type InputOf,
  NotificationStrategy,
} from '../../../notifications/notification.strategy';
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
        project: e.cast(e.Project, e.uuid(input.project)),
        changedBy: e.cast(e.User, e.uuid(input.changedBy)),
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
            project: ['Project', input.project],
            changedBy: ['User', input.changedBy],
          },
        ),
      );
  }

  hydrateExtraForNeo4j(outVar: string) {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('out', '', 'project'),
          node('project', 'Project'),
        ])
        .match([
          node('node'),
          relation('out', '', 'changedBy'),
          node('changedBy', 'User'),
        ])
        .return(
          exp({
            project: 'project { .id }',
            changedBy: 'changedBy { .id }',
          }).as(outVar),
        );
  }

  renderEmail(
    notification: ProjectTransitionRequiringFinancialApprovalNotification,
  ) {
    return EmailMessage.from(
      <ProjectStepChangedNotification
        projectId={notification.project.id}
        changedById={notification.changedBy.id}
        previousStep={notification.previousStep}
      />,
    );
  }
}
