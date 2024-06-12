import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ID, Many } from '~/common';
import { ResourceGranter } from '../authorization';
import { action } from '../authorization/policy/builder/perm-granter';
import { PropsGranterFn } from '../authorization/policy/builder/resource-granter';
import {
  Condition,
  eqlInLiteralSet,
  IsAllowedParams,
} from '../authorization/policy/conditions';
import { Workflow } from './define-workflow';

export function WorkflowEventGranter<W extends Workflow>(workflow: W) {
  type State = Workflow['state'];
  type Names = Workflow['transition']['name'];
  type EventClass = Workflow['eventResource'];

  abstract class WorkflowEventGranterClass extends ResourceGranter<EventClass> {
    get read() {
      return this[action]('read');
    }

    /**
     * Allow bypassing workflow to set certain statuses.
     */
    get allowBypass(): this {
      const cloned = this.or[action]('create');
      cloned.stagedCondition = this.stagedCondition;
      cloned.trailingCondition = this.trailingCondition;
      return cloned;
    }

    /**
     * Can read & execute all transitions.
     */
    get executeAll(): this {
      return this.transitions(workflow.transitions.map((t) => t.name)).execute;
    }

    /**
     * Can execute transition.
     */
    get execute() {
      return this[action]('create');
    }

    isTransitions(...transitions: Array<Many<Names>>) {
      return TransitionCondition.fromName(transitions.flat());
    }

    transitions(...transitions: Array<Many<Names>>) {
      return this.when(this.isTransitions(...transitions));
    }

    isState(...states: Array<Many<State>>) {
      return TransitionCondition.fromEndState(states.flat());
    }

    state(...states: Array<Many<State>>) {
      return this.when(this.isState(...states));
    }

    specifically(grants: PropsGranterFn<EventClass>): this {
      return super.specifically(grants);
    }
  }

  interface TransitionCheck {
    key: ID[];
    name?: Names;
    endState?: State;
  }

  class TransitionCondition implements Condition<EventClass> {
    private readonly allowedTransitionKeys;

    protected constructor(private readonly checks: readonly TransitionCheck[]) {
      this.allowedTransitionKeys = new Set(checks.flatMap((c) => c.key));
    }

    static fromName(transitionNames: readonly Names[]) {
      const allowed = new Set(transitionNames);
      return new TransitionCondition(
        [...allowed].map((name) => ({
          name,
          key: [workflow.transitions.find((t) => t.name === name)!.key],
        })),
      );
    }

    static fromEndState(states: readonly State[]) {
      const allowed = new Set(states);
      return new TransitionCondition(
        [...allowed].map((endState) => ({
          endStatus: endState,
          key: workflow.transitions
            // TODO handle dynamic to?
            .filter((t) => typeof t.to === 'string' && allowed.has(t.to))
            .map((t) => t.key),
        })),
      );
    }

    isAllowed({ object }: IsAllowedParams<EventClass>) {
      if (!object) {
        // We are expecting to be called without an object sometimes.
        // These should be treated as false without error.
        return false;
      }
      const transitionKey = Reflect.get(object, TransitionKey);
      if (!transitionKey) {
        return false;
      }
      return this.allowedTransitionKeys.has(transitionKey);
    }

    asCypherCondition(query: Query) {
      // TODO bypasses to statuses won't work with this. How should these be filtered?
      const required = query.params.addParam(
        this.allowedTransitionKeys,
        'allowedTransitions',
      );
      return `node.transition IN ${String(required)}`;
    }

    asEdgeQLCondition() {
      // TODO bypasses to statuses won't work with this. How should these be filtered?
      const transitionAllowed = eqlInLiteralSet(
        '.transitionKey',
        this.allowedTransitionKeys,
        'uuid',
      );
      // If no transition then false
      return `((${transitionAllowed}) ?? false)`;
    }

    union(this: void, conditions: readonly this[]) {
      const checks = [
        ...new Map(
          conditions
            .flatMap((condition) => condition.checks)
            .map((check) => {
              const key = check.name
                ? `name:${check.name}`
                : `state:${check.endState!}`;
              return [key, check];
            }),
        ).values(),
      ];
      return new TransitionCondition(checks);
    }

    intersect(this: void, conditions: readonly this[]) {
      const checks = [...conditions[0].checks].filter((check1) =>
        conditions.every((cond) =>
          cond.checks.some(
            (check2) =>
              check1.name === check2.name ||
              check1.endState === check2.endState,
          ),
        ),
      );
      return new TransitionCondition(checks);
    }

    [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
      const render = (label: string, items: readonly string[]) => {
        const itemsStr = items.map((l) => `  ${l}`).join('\n');
        return `${label} {\n${itemsStr}\n}`;
      };
      if (this.allowedTransitionKeys.size === 0) {
        return 'No Transitions';
      }
      const checkNames = this.checks.flatMap((c) => c.name ?? []);
      const checkEndStates = this.checks.flatMap((c) => c.endState ?? []);
      const transitions =
        checkNames.length > 0 ? render('Transitions', checkNames) : undefined;
      const endStates =
        checkEndStates.length > 0
          ? render('End States', checkEndStates)
          : undefined;
      if (transitions && endStates) {
        return `(${transitions} OR ${endStates})`;
      }
      return transitions ?? endStates!;
    }
  }

  return WorkflowEventGranterClass;
}

const TransitionKey = Symbol('TransitionKey');

export const withTransitionKey = <T extends object>(
  obj: T,
  transitionKey: ID,
) =>
  Object.defineProperty(obj, TransitionKey, {
    value: transitionKey,
    enumerable: false,
    configurable: true,
  });
