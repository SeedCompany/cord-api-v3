import { entries } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { ID, isIdLike, Many } from '~/common';
import { Granter, ResourceGranter } from '../../authorization';
import { action } from '../../authorization/policy/builder/perm-granter';
import { PropsGranterFn } from '../../authorization/policy/builder/resource-granter';
import {
  Condition,
  eqlInLiteralSet,
  IsAllowedParams,
} from '../../authorization/policy/conditions';
import { ProjectStep } from '../dto';
import { ProjectWorkflowEvent as Event } from './dto';
import { TransitionName, Transitions } from './transitions';

// As string literal so policies don't have to import enum
type Status = `${ProjectStep}`;

@Granter(Event)
export class ProjectWorkflowEventGranter extends ResourceGranter<typeof Event> {
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
    return this.transitions(entries(Transitions).map(([k]) => k)).execute;
  }

  /**
   * Can execute transition.
   */
  get execute() {
    return this[action]('create');
  }

  isTransitions(...transitions: Array<Many<TransitionName>>) {
    return TransitionCondition.fromName(transitions.flat());
  }

  transitions(...transitions: Array<Many<TransitionName>>) {
    return this.when(this.isTransitions(...transitions));
  }

  isStatus(...statuses: Array<Many<Status>>) {
    return TransitionCondition.fromEndStatus(statuses.flat());
  }

  status(...statuses: Array<Many<Status>>) {
    return this.when(this.isStatus(...statuses));
  }

  specifically(grants: PropsGranterFn<typeof Event>): this {
    return super.specifically(grants);
  }
}

interface TransitionCheck {
  key: ID[];
  name?: TransitionName;
  endStatus?: Status;
}

class TransitionCondition implements Condition<typeof Event> {
  private readonly allowedTransitionKeys;

  protected constructor(private readonly checks: readonly TransitionCheck[]) {
    this.allowedTransitionKeys = new Set(checks.flatMap((c) => c.key));
  }

  static fromName(transitions: readonly TransitionName[]) {
    const allowed = new Set(transitions);
    return new TransitionCondition(
      [...allowed].map((name) => ({
        name,
        key: [Transitions[name].key],
      })),
    );
  }

  static fromEndStatus(statuses: readonly Status[]) {
    const allowed = new Set(statuses);
    return new TransitionCondition(
      [...allowed].map((endStatus) => ({
        endStatus,
        key: Object.values(Transitions)
          // TODO handle dynamic to?
          .filter((t) => typeof t.to === 'string' && allowed.has(t.to))
          .map((t) => t.key),
      })),
    );
  }

  isAllowed({ object }: IsAllowedParams<typeof Event>) {
    if (!object) {
      // We are expecting to be called without an object sometimes.
      // These should be treated as false without error.
      return false;
    }
    const transitionKey = object.transition;
    if (!transitionKey) {
      return false;
    }
    return this.allowedTransitionKeys.has(
      isIdLike(transitionKey) ? transitionKey : transitionKey.key,
    );
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

  union(this: void, conditions: this[]) {
    const checks = [
      ...new Map(
        conditions
          .flatMap((condition) => condition.checks)
          .map((check) => {
            const key = check.name
              ? `name:${check.name}`
              : `status:${check.endStatus!}`;
            return [key, check];
          }),
      ).values(),
    ];
    return new TransitionCondition(checks);
  }

  intersect(this: void, conditions: this[]) {
    const checks = [...conditions[0].checks].filter((check1) =>
      conditions.every((cond) =>
        cond.checks.some(
          (check2) =>
            check1.name === check2.name ||
            check1.endStatus === check2.endStatus,
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
    const byName = this.checks.filter((c) => c.name);
    const byEndStatus = this.checks.filter((c) => c.endStatus);
    const transitions =
      byName.length > 0
        ? render(
            'Transitions',
            byName.map((c) => c.name!),
          )
        : undefined;
    const endStatuses =
      byEndStatus.length > 0
        ? render(
            'End Statuses',
            byEndStatus.map((c) => c.endStatus!),
          )
        : undefined;
    if (transitions && endStatuses) {
      return `(${transitions} OR ${endStatuses})`;
    }
    return transitions ?? endStatuses!;
  }
}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    ProjectWorkflowEvent: ProjectWorkflowEventGranter;
  }
}
