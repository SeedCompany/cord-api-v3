import { Field, ObjectType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { TransitionType } from '../../../project/workflow/dto';
import { ProgressReportStatus } from '../../dto';

export { TransitionType };

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
