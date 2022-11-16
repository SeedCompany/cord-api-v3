import { ArgsType, Field } from '@nestjs/graphql';
import { ID, IdField } from '~/common';
import { ProgressReportStatus } from '../../dto';

@ArgsType()
export abstract class ExecuteProgressReportTransitionInput {
  @IdField({
    name: 'id',
  })
  readonly reportId: ID;

  @IdField({
    name: 'transition',
    description: 'Execute this transition',
    nullable: true,
  })
  readonly transitionId?: ID;

  @Field(() => ProgressReportStatus, {
    description: 'Bypass the workflow, and go straight to this status.',
    nullable: true,
  })
  readonly status?: ProgressReportStatus;
}
