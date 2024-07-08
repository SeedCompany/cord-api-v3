import { entries, many, setOf } from '@seedcompany/common';
import * as uuid from 'uuid';
import {
  EnumType,
  ID,
  MadeEnum,
  Many,
  maybeMany,
  NotFoundException,
  ResourceShape,
} from '~/common';
import { WorkflowEvent } from './dto';
import { InternalTransition, TransitionInput } from './transitions/types';

export const defineWorkflow =
  <
    const Name extends string,
    const Context,
    const EventResource extends ResourceShape<
      ReturnType<typeof WorkflowEvent>['prototype']
    >,
    const StateEnum extends MadeEnum<any>,
    const State extends EnumType<StateEnum>,
  >(input: {
    id: string;
    name: Name;
    states: StateEnum;
    event: EventResource;
    /**
     * Declare the context type here.
     * @example
     * context: defineContext<X>
     */
    context: () => Context;
    /**
     * Middleware functions to adapt built transitions.
     */
    transitionEnhancers?: Many<TransitionEnhancer<State, Context>>;
  }) =>
  <TransitionNames extends string>(
    obj: Record<TransitionNames, TransitionInput<State, Context>>,
  ) => {
    const enhancers = many(input.transitionEnhancers ?? []);

    const transitions = entries(obj).map(([name, transition]) => {
      const normalized: InternalTransition<State, TransitionNames, Context> = {
        name,
        ...transition,
        from: transition.from ? setOf(many(transition.from)) : undefined,
        key: (transition.key ?? uuid.v5(name, input.id)) as ID,
        conditions: maybeMany(transition.conditions) ?? [],
        notifiers: maybeMany(transition.notifiers) ?? [],
      };
      const enhanced = enhancers.reduce(
        (t, enhancer) => enhancer(t),
        normalized,
      );
      return enhanced;
    });

    const workflow: Workflow<
      Name,
      Context,
      EventResource,
      State,
      StateEnum,
      TransitionNames
    > = {
      ...input,
      id: input.id as ID,
      transitions,
      eventResource: input.event,
      transitionByKey: (key: ID) => {
        const transition = workflow.transitions.find((t) => t.key === key);
        if (!transition) {
          throw new NotFoundException(
            `${workflow.name} workflow transition for key "${key}" does not exist.`,
          );
        }
        return transition;
      },
      transitionByName: (name: TransitionNames) => {
        const transition = workflow.transitions.find((t) => t.name === name);
        if (!transition) {
          throw new NotFoundException(
            `${workflow.name} workflow transition named "${name}" does not exist`,
          );
        }
        return transition;
      },
      pickNames: <Names extends TransitionNames>(
        ...transitions: Array<Many<Names>>
      ) => setOf(transitions.flat() as Names[]),
      // type-only props
      event: undefined as any,
      state: undefined as any,
      context: undefined as any,
      transition: undefined as any,
      resolvedTransition: undefined as any,
    };
    return workflow;
  };

/**
 * A helper to declare the context type within the js object
 */
export const defineContext = <Context>(): Context => null as any;

/**
 * This shape helps TS emit the type in a coherent way.
 */
export interface Workflow<
  Name extends string = string,
  Context = any,
  EventResource extends ResourceShape<
    ReturnType<typeof WorkflowEvent>['prototype']
  > = ResourceShape<ReturnType<typeof WorkflowEvent>['prototype']>,
  State extends string = string,
  StateEnum extends MadeEnum<State> = MadeEnum<State>,
  TransitionNames extends string = string,
  Transition extends InternalTransition<
    State,
    TransitionNames,
    Context
  > = InternalTransition<State, TransitionNames, Context>,
  Transitions extends readonly Transition[] = readonly Transition[],
> {
  readonly name: Name;
  readonly id: ID;
  /** type only */
  readonly context: Context;
  /** type only */
  readonly event: EventResource['prototype'];
  readonly eventResource: EventResource;
  /** type only */
  readonly state: State;
  readonly states: StateEnum;
  readonly transitions: Transitions;
  /** type only */
  readonly transition: Transition;
  /** type only */
  readonly resolvedTransition: Omit<Transition, 'to'> & { to: State };
  readonly transitionByKey: (key: ID) => Transition;
  readonly transitionByName: <Names extends TransitionNames>(
    name: Names,
  ) => Transition;
  readonly pickNames: <Names extends TransitionNames>(
    ...keys: Array<Many<Names>>
  ) => ReadonlySet<Names>;
}

export type TransitionEnhancer<State extends string, Context> = (
  transition: InternalTransition<State, any, Context>,
) => InternalTransition<State, any, Context>;
