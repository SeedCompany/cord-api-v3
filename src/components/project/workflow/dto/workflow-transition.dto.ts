import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { EnumType, ID, IdField, makeEnum } from '~/common';
import { ProjectStep } from '../../dto';

export type TransitionType = EnumType<typeof TransitionType>;
export const TransitionType = makeEnum({
  name: 'TransitionType',
  values: ['Neutral', 'Approve', 'Reject'],
});

@ObjectType('ProjectStepTransition', {
  description: stripIndent`
    A transition for the project workflow.

    This is not a normalized entity.
    A transition represented by its \`key\` can have different field values
    based on the project's state.
  `,
})
export abstract class ProjectWorkflowTransition {
  @IdField({
    description: stripIndent`
      An local identifier for this transition.
      It cannot be used to globally identify a transition.
      It is passed to \`transitionProject\`.
    `,
  })
  readonly key: ID;

  @Field(() => ProjectStep)
  readonly to: ProjectStep;

  @Field()
  readonly label: string;

  @Field(() => TransitionType)
  readonly type: TransitionType;

  @Field(() => Boolean, { defaultValue: false })
  readonly disabled?: boolean;

  @Field(() => String, { nullable: true })
  readonly disabledReason?: string;
}
