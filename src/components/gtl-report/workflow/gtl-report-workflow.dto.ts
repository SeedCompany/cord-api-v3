import { Field, ID as IDType, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DateTimeField,
  type ID,
  IdField,
  type RichTextDocument,
  RichTextField,
} from '~/common';
import { TransitionType } from '../../workflow/dto/workflow-transition.dto';
import { GtlReportStatus } from '../dto/gtl-report-status.enum';

@ObjectType({
  description: 'A transition available from the report’s current state',
})
export abstract class GtlReportWorkflowTransition {
  @Field(() => IDType)
  readonly key: ID;

  @Field()
  readonly label: string;

  @Field(() => GtlReportStatus)
  readonly to: GtlReportStatus;

  @Field(() => TransitionType)
  readonly type: TransitionType;

  @Field({
    description:
      'Whether the requesting user may execute this transition right now',
  })
  readonly canExecute: boolean;
}

@ObjectType({ description: 'One status change in a report’s history' })
export abstract class GtlReportWorkflowEvent {
  @Field(() => IDType)
  readonly id: ID;

  @Field(() => GtlReportStatus)
  readonly to: GtlReportStatus;

  @Field(() => IDType, { nullable: true })
  readonly transition: ID | null;

  @DateTimeField()
  readonly at: DateTime;

  @Field(() => IDType)
  readonly who: ID;
}

@InputType()
export class ExecuteGtlReportTransition {
  @IdField()
  readonly report: ID;

  @IdField({ description: 'The transition key, from `GTLReport.transitions`' })
  readonly transition: ID;

  @RichTextField({ nullable: true })
  readonly notes?: RichTextDocument | null;
}
