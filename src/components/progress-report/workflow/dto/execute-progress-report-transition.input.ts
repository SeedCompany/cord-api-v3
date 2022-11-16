import { ArgsType, Field } from '@nestjs/graphql';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { ProgressReportStatus } from '../../dto';

@ArgsType()
export abstract class ExecuteProgressReportTransitionInput {
  @IdField({
    name: 'reportId',
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

  @RichTextField({
    nullable: true,
  })
  readonly notes?: RichTextDocument;
}
