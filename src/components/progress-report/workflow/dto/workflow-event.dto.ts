import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  IdField,
  IdOf,
  Secured,
  SecuredProps,
  SecuredRichTextNullable,
  SetUnsecuredType,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { User } from '../../../user';
import { ProgressReportStatus } from '../../dto';
import { InternalTransition } from '../transitions';
import { ProgressReportWorkflowTransition as PublicTransition } from './workflow-transition.dto';

@RegisterResource({ db: e.ProgressReport.WorkflowEvent })
@ObjectType()
export abstract class ProgressReportWorkflowEvent {
  static readonly Props = keysOf<ProgressReportWorkflowEvent>();
  static readonly SecuredProps =
    keysOf<SecuredProps<ProgressReportWorkflowEvent>>();
  static readonly BaseNodeProps = ['id', 'createdAt', 'status', 'transition'];

  @IdField()
  readonly id: ID;

  readonly who: Secured<IdOf<User>>;

  @DateTimeField()
  readonly at: DateTime;

  @Field(() => PublicTransition, {
    nullable: true,
    description: 'THe transition taken, null if workflow was bypassed',
  })
  readonly transition?: InternalTransition & SetUnsecuredType<ID>;

  @Field(() => ProgressReportStatus)
  readonly status: ProgressReportStatus;

  @Field()
  readonly notes: SecuredRichTextNullable;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportWorkflowEvent: typeof ProgressReportWorkflowEvent;
  }
  interface ResourceDBMap {
    ProgressReportWorkflowEvent: typeof e.ProgressReport.WorkflowEvent;
  }
}
