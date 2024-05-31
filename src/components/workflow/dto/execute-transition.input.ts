import { Field, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  ID,
  IdField,
  MadeEnum,
  RichTextDocument,
  RichTextField,
} from '~/common';

export function ExecuteTransitionInput<State extends string>(
  state: MadeEnum<State>,
) {
  @InputType({ isAbstract: true })
  abstract class ExecuteTransitionInputClass {
    @IdField({
      description: stripIndent`
        The transition \`key\` to execute.
        This is required unless specifying bypassing the workflow with a \`step\` input.
      `,
      nullable: true,
    })
    readonly transition?: ID;

    @Field(() => state as object, {
      description: stripIndent`
        Bypass the workflow, and go straight to this state.
        \`transition\` is not required and ignored when using this.
      `,
      nullable: true,
    })
    readonly bypassTo?: State;

    @RichTextField({
      description: 'Any additional user notes related to this transition',
      nullable: true,
    })
    readonly notes?: RichTextDocument;
  }
  return ExecuteTransitionInputClass;
}
