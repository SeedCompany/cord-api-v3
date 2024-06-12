import { createUnionType, Field, ObjectType } from '@nestjs/graphql';
import { cacheable } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import * as uuid from 'uuid';
import { DataObject, ID, IdField, Role } from '~/common';
import { Workflow } from '../define-workflow';
import { DynamicState } from '../transitions/dynamic-state';
import { TransitionType } from './workflow-transition.dto';

@ObjectType('WorkflowState')
export class SerializedWorkflowState extends DataObject {
  @Field()
  readonly value: string;

  @Field()
  readonly label: string;
}

@ObjectType('WorkflowTransitionStaticTo')
export class SerializedWorkflowTransitionStaticTo extends DataObject {
  @Field()
  readonly state: SerializedWorkflowState;
}

@ObjectType('WorkflowTransitionDynamicTo')
export class SerializedWorkflowTransitionDynamicTo extends DataObject {
  @IdField()
  readonly id: string;

  @Field()
  readonly label: string;

  @Field(() => [SerializedWorkflowState])
  readonly relatedStates: readonly SerializedWorkflowState[];
}

export const SerializedWorkflowTransitionTo = createUnionType({
  name: 'WorkflowTransitionTo',
  types: () => [
    SerializedWorkflowTransitionStaticTo,
    SerializedWorkflowTransitionDynamicTo,
  ],
  resolveType: (
    value:
      | SerializedWorkflowTransitionStaticTo
      | SerializedWorkflowTransitionDynamicTo,
  ) =>
    'state' in value
      ? SerializedWorkflowTransitionStaticTo
      : SerializedWorkflowTransitionDynamicTo,
});

@ObjectType('WorkflowCondition')
export class SerializedWorkflowCondition extends DataObject {
  @Field()
  readonly label: string;
}

@ObjectType('WorkflowNotifier')
export class SerializedWorkflowNotifier extends DataObject {
  @Field()
  readonly label: string;
}

@ObjectType('WorkflowTransitionPermission', {
  description: stripIndent`
    A permission for a transition.

    This will either have \`readEvent\` or \`execute\` as a boolean,
    specifying the action this permission defines.
    If this is true, there could still be a condition that must be met,
    described by the \`condition\` field.
  `,
})
export class SerializedWorkflowTransitionPermission extends DataObject {
  @Field(() => Role)
  role: Role;

  @Field({
    description:
      'The action for this permission is conditional, described by this field.',
    nullable: true,
  })
  condition?: string;

  @Field({
    description: 'Can this role read historical events for this transition?',
    nullable: true,
  })
  readEvent?: boolean;

  @Field({
    description: 'Can this role execute this transition?',
    nullable: true,
  })
  execute?: boolean;
}

@ObjectType('WorkflowTransition')
export class SerializedWorkflowTransition extends DataObject {
  @IdField()
  readonly key: ID;

  @Field()
  readonly devName: string;

  @Field()
  readonly label: string;

  @Field(() => TransitionType)
  readonly type: TransitionType;

  @Field(() => [SerializedWorkflowState])
  readonly from: readonly SerializedWorkflowState[];

  @Field(() => SerializedWorkflowTransitionTo)
  readonly to: typeof SerializedWorkflowTransitionTo;

  @Field(() => [SerializedWorkflowCondition])
  readonly conditions: readonly SerializedWorkflowCondition[];

  @Field(() => [SerializedWorkflowNotifier])
  readonly notifiers: readonly SerializedWorkflowNotifier[];

  @Field(() => [SerializedWorkflowTransitionPermission])
  readonly permissions: readonly SerializedWorkflowTransitionPermission[];
}

@ObjectType('Workflow')
export class SerializedWorkflow extends DataObject {
  @IdField()
  readonly id: ID;

  @Field(() => [SerializedWorkflowState])
  readonly states: readonly SerializedWorkflowState[];

  @Field(() => [SerializedWorkflowTransition])
  readonly transitions: readonly SerializedWorkflowTransition[];

  static from<W extends Workflow>(
    workflow: W,
    getPermissions: (
      transition: W['transition'],
    ) => readonly SerializedWorkflowTransitionPermission[],
  ): SerializedWorkflow {
    const serializeState = (state: Workflow['state']) => {
      const { value, label } = workflow.states.entry(state);
      return { value, label };
    };
    const dynamicToId = cacheable(
      new Map<DynamicState<W['state'], W['context']>, string>(),
      ({ resolve, ...props }) => uuid.v5(JSON.stringify(props), workflow.id),
    );
    return {
      id: workflow.id,
      states: [...workflow.states].map(serializeState),
      transitions: workflow.transitions.map((transition) => ({
        key: transition.key,
        devName: transition.name,
        label: transition.label,
        type: transition.type,
        from: transition.from ? [...transition.from].map(serializeState) : [],
        to:
          typeof transition.to === 'string'
            ? {
                state: serializeState(transition.to),
              }
            : {
                id: dynamicToId(transition.to),
                label: transition.to.description,
                relatedStates:
                  transition.to.relatedStates?.map(serializeState) ?? [],
              },
        conditions: (transition.conditions ?? []).map((condition) => ({
          label: condition.description,
        })),
        notifiers: (transition.notifiers ?? []).map((notifier) => ({
          label: notifier.description,
        })),
        permissions: getPermissions(transition),
      })),
    };
  }
}
