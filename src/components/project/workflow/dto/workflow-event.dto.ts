import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { WorkflowEvent } from '../../../workflow/dto';
import { IProject, ProjectStep } from '../../dto';
import { ProjectWorkflowTransition } from './workflow-transition.dto';

@RegisterResource({ db: e.Project.WorkflowEvent })
@ObjectType()
export abstract class ProjectWorkflowEvent extends WorkflowEvent(
  ProjectStep,
  ProjectWorkflowTransition,
) {
  static readonly Props = keysOf<ProjectWorkflowEvent>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectWorkflowEvent>>();
  static readonly BaseNodeProps = WorkflowEvent.BaseNodeProps;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  readonly project: Pick<IProject, 'id' | 'type'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectWorkflowEvent: typeof ProjectWorkflowEvent;
  }
  interface ResourceDBMap {
    ProjectWorkflowEvent: typeof e.Project.WorkflowEvent;
  }
}
