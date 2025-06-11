import { type Merge } from 'type-fest';
import { type ID, type Many } from '~/common';
import { type WorkflowTransition as PublicTransition } from '../dto/workflow-transition.dto';
import { type TransitionCondition } from './conditions';
import { type DynamicState } from './dynamic-state';
import { type TransitionNotifier } from './notifiers';

export type TransitionInput<State extends string, Context> = Merge<
  ReturnType<typeof PublicTransition<State>>['prototype'],
  Readonly<{
    key?: ID | string;
    from?: Many<State>;
    to: State | DynamicState<State, Context>;
    conditions?: Many<TransitionCondition<Context>>;
    notifiers?: Many<TransitionNotifier<Context>>;
  }>
>;

export type InternalTransition<State extends string, Names extends string, Context> = Merge<
  TransitionInput<State, Context>,
  Readonly<{
    name: Names;
    key: ID;
    from?: ReadonlySet<State>;
    conditions: ReadonlyArray<TransitionCondition<Context>>;
    notifiers: ReadonlyArray<TransitionNotifier<Context>>;
  }>
>;
