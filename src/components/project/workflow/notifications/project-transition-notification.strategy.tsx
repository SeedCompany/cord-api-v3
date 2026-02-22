import { node, type Query, relation } from 'cypher-query-builder';
import { type AbstractClass } from 'type-fest';
import { EnhancedResource } from '~/common';
import { EmailMessage } from '~/core/email';
import { e } from '~/core/gel';
import { createRelationships, exp } from '~/core/neo4j/query';
import { INotificationStrategy, type InputOf } from '../../../notifications';
import { ProjectStepChangedNotification } from '../emails/project-step-changed-notification.email';
import { type ProjectTransitionNotification } from './project-transition-notification.dto';
import type { ProjectTransitionViaMembershipNotification } from './project-transition-via-membership-notification.dto';

/**
 * Shared input type for all ProjectTransition notification strategies.
 * Both concrete DTOs have the same extra fields (workflowEvent + previousStep).
 */
export type ProjectTransitionInput = InputOf<ProjectTransitionNotification>;

export abstract class ProjectTransitionNotificationStrategy<
  T extends ProjectTransitionViaMembershipNotification,
> extends INotificationStrategy<T, ProjectTransitionInput> {
  protected abstract readonly dtoClass: AbstractClass<T>;

  saveForNeo4j({ previousStep, workflowEvent }: ProjectTransitionInput) {
    return (query: Query) =>
      query
        .setValues({ node: { previousStep } }, true)
        .with('node')
        .apply(
          createRelationships(this.dtoClass, 'out', {
            workflowEvent: ['ProjectWorkflowEvent', workflowEvent],
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

  insertForGel(input: ProjectTransitionInput) {
    return e.insert(
      EnhancedResource.resolve(this.dtoClass)
        .db as unknown as typeof e.Notification.ProjectTransition,
      {
        workflowEvent: e.cast(
          e.Project.WorkflowEvent,
          e.uuid(input.workflowEvent),
        ),
        previousStep: e.cast(e.Project.Step, input.previousStep),
      },
    );
  }

  renderEmail(notification: T) {
    return EmailMessage.from(
      <ProjectStepChangedNotification
        workflowEventId={notification.workflowEvent.id}
        previousStep={notification.previousStep}
      />,
    );
  }
}
