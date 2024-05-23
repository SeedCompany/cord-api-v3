import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';
import { ProjectStep } from '../../dto';

@InputType()
export abstract class ExecuteProjectTransitionInput {
  @IdField({
    description: 'The project ID to transition',
  })
  readonly project: ID;

  @IdField({
    description: stripIndent`
      The transition \`key\` to execute.
      This is required unless specifying bypassing the workflow with a \`step\` input.
    `,
    nullable: true,
  })
  readonly transition?: ID;

  @Field(() => ProjectStep, {
    description: stripIndent`
      Bypass the workflow, and go straight to this step.
      \`transition\` is not required and ignored when using this.
    `,
    nullable: true,
  })
  readonly step?: ProjectStep;

  @RichTextField({
    description: 'Any additional user notes related to this transition',
    nullable: true,
  })
  readonly notes?: RichTextDocument;
}
