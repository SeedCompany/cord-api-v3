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
import { ProjectTransitionViaMembershipNotification } from './project-transition-via-membership-notification.dto';

@NotificationStrategy(ProjectTransitionViaMembershipNotification)
export class ProjectTransitionViaMembershipNotificationStrategy extends INotificationStrategy<ProjectTransitionViaMembershipNotification> {
  getDescription() {
    return 'When a project you are a member of transitions to a new step';
  }

  insertForGel(input: InputOf<ProjectTransitionViaMembershipNotification>) {
    return e.insert(e.Notification.ProjectTransitionViaMembership, {
      project: e.cast(e.Project, e.uuid(input.project)),
      changedBy: e.cast(e.User, e.uuid(input.changedBy)),
      previousStep: e.cast(e.Project.Step, input.previousStep),
    });
  }

  saveForNeo4j(input: InputOf<ProjectTransitionViaMembershipNotification>) {
    return (query: Query) =>
      query.apply(
        createRelationships(ProjectTransitionViaMembershipNotification, 'out', {
          project: ['Project', input.project],
          changedBy: ['User', input.changedBy],
        }),
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

  renderEmail(notification: ProjectTransitionViaMembershipNotification) {
    return EmailMessage.from(
      <ProjectStepChangedNotification
        projectId={notification.project.id}
        changedById={notification.changedBy.id}
        previousStep={notification.previousStep}
      />,
    );
  }
}
