import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { EnumType, ID, IdField, MadeEnum, makeEnum } from '~/common';

export type TransitionType = EnumType<typeof TransitionType>;
export const TransitionType = makeEnum({
  name: 'TransitionType',
  values: ['Neutral', 'Approve', 'Reject'],
});

export function WorkflowTransition<State extends string>(
  state: MadeEnum<State>,
) {
  @ObjectType({ isAbstract: true })
  abstract class WorkflowTransitionClass {
    @IdField({
      description: stripIndent`
        An local identifier for this transition.
        It cannot be used to globally identify a transition.
        It is passed to the transition mutation.
      `,
    })
    readonly key: ID;

    @Field(() => state as object)
    readonly to: State;

    @Field()
    readonly label: string;

    @Field(() => TransitionType)
    readonly type: TransitionType;

    @Field(() => Boolean, { defaultValue: false })
    readonly disabled?: boolean;

    @Field(() => String, { nullable: true })
    readonly disabledReason?: string;
  }
  return WorkflowTransitionClass;
}
WorkflowTransition.descriptionFor = (workflowName: string) =>
  stripIndent`
    A transition for the ${workflowName} workflow.

    This is not a normalized entity.
    A transition represented by its \`key\` can have different field values
    based on the workflow's state.
  `;
