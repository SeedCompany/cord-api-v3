import { Field, ObjectType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { TransitionType } from '../../../workflow/dto';
import { ProgressReportStatus } from '../../dto/progress-report-status.enum';

@ObjectType()
export abstract class ProgressReportWorkflowTransition {
  @IdField()
  readonly id: ID;

  @Field(() => ProgressReportStatus)
  readonly to: ProgressReportStatus;

  @Field()
  readonly label: string;

  @Field(() => TransitionType)
  readonly type: TransitionType;
}
