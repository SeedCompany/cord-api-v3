import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  IdField,
  Secured,
  SecuredProps,
  SecuredRichTextNullable,
  SetUnsecuredType,
} from '~/common';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { ProjectStep } from '../../dto';
import type { InternalTransition } from '../transitions';
import { ProjectWorkflowTransition as PublicTransition } from './workflow-transition.dto';

@RegisterResource({ db: e.Project.WorkflowEvent })
@ObjectType()
export abstract class ProjectWorkflowEvent {
  static readonly Props = keysOf<ProjectWorkflowEvent>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectWorkflowEvent>>();
  static readonly BaseNodeProps = ['id', 'createdAt', 'step', 'transition'];

  @IdField()
  readonly id: ID;

  readonly who: Secured<LinkTo<'User'>>;

  @DateTimeField()
  readonly at: DateTime;

  @Field(() => PublicTransition, {
    nullable: true,
    description: 'The transition taken, null if workflow was bypassed',
  })
  readonly transition:
    | (InternalTransition & SetUnsecuredType<ID | null>)
    | null;

  // TODO maybe add `from`?

  @Field(() => ProjectStep)
  readonly to: ProjectStep;

  @Field()
  readonly notes: SecuredRichTextNullable;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectWorkflowEvent: typeof ProjectWorkflowEvent;
  }
  interface ResourceDBMap {
    ProjectWorkflowEvent: typeof e.Project.WorkflowEvent;
  }
}
