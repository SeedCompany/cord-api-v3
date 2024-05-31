import { many, mapValues, setOf } from '@seedcompany/common';
import { Merge } from 'type-fest';
import * as uuid from 'uuid';
import { ID, Many, maybeMany } from '~/common';
import { WorkflowTransition as PublicTransition } from '../dto/workflow-transition.dto';
import { TransitionCondition } from './conditions';
import { DynamicState } from './dynamic-state';
import { TransitionNotifier } from './notifiers';

export type TransitionInput<State extends string, Context> = Merge<
  ReturnType<typeof PublicTransition<State>>['prototype'],
  {
    key?: ID | string;
    from?: Many<State>;
    to: State | DynamicState<State, Context>;
    conditions?: Many<TransitionCondition<Context>>;
    notifiers?: Many<TransitionNotifier<Context>>;
  }
>;

export type InternalTransition<
  State extends string,
  Names extends string,
  Context,
> = Merge<
  TransitionInput<State, Context>,
  {
    name: Names;
    key: ID;
    from?: ReadonlySet<State>;
    conditions?: ReadonlyArray<TransitionCondition<Context>>;
    notifiers?: ReadonlyArray<TransitionNotifier<Context>>;
  }
>;

export const defineTransitions =
  <State extends string, Context>(options: { namespaceId: string }) =>
  <Names extends string>(obj: Record<Names, TransitionInput<State, Context>>) =>
    mapValues(
      obj,
      (name, transition): InternalTransition<State, Names, Context> => ({
        name: name,
        ...transition,
        from: transition.from ? setOf(many(transition.from)) : undefined,
        key: (transition.key ?? uuid.v5(name, options.namespaceId)) as ID,
        conditions: maybeMany(transition.conditions),
        notifiers: maybeMany(transition.notifiers),
      }),
    ).asRecord;
