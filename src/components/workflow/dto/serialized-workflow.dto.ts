import { createUnionType, Field, ObjectType } from '@nestjs/graphql';
import { cacheable } from '@seedcompany/common';
import * as uuid from 'uuid';
import { DataObject, ID, IdField } from '~/common';
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
}

@ObjectType('Workflow')
export class SerializedWorkflow extends DataObject {
  @IdField()
  readonly id: ID;

  @Field(() => [SerializedWorkflowState])
  readonly states: readonly SerializedWorkflowState[];

  @Field(() => [SerializedWorkflowTransition])
  readonly transitions: readonly SerializedWorkflowTransition[];

  static from<W extends Workflow>(workflow: W): SerializedWorkflow {
    const serializeState = (state: Workflow['state']) => {
      const { value, label } = workflow.states.entry(state);
      return { value, label };
    };
    const dynamicToId = cacheable(
      new Map<DynamicState<W['state'], W['context']>, string>(),
      () => uuid.v1(),
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
      })),
    };
  }
}
