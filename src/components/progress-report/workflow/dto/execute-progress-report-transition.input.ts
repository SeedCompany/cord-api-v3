import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { ProgressReportStatus } from '../../dto';

@InputType()
export abstract class ExecuteProgressReportTransitionInput {
  @IdField({
    description: 'The progress report ID to transition',
  })
  readonly report: ID;

  @IdField({
    description: stripIndent`
      Execute this transition.
      This is required unless specifying bypassing the workflow with a \`status\` input.
    `,
    nullable: true,
  })
  readonly transition?: ID;

  @Field(() => ProgressReportStatus, {
    description: stripIndent`
      Bypass the workflow, and go straight to this status.
      \`transition\` is not required and ignored when using this.
    `,
    nullable: true,
  })
  readonly status?: ProgressReportStatus;

  @RichTextField({
    description: 'Any additional user notes related to this transition',
    nullable: true,
  })
  readonly notes?: RichTextDocument;
}
