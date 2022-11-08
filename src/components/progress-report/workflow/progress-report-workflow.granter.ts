import { Query } from 'cypher-query-builder';
import { ID, isIdLike, keys, Many } from '~/common';
import { Granter, ResourceGranter } from '../../authorization';
import { action } from '../../authorization/policy/builder/perm-granter';
import { PropsGranterFn } from '../../authorization/policy/builder/resource-granter';
import {
  Condition,
  IsAllowedParams,
} from '../../authorization/policy/conditions';
import { ProgressReportStatus } from '../dto';
import { ProgressReportWorkflowEvent as Event } from './dto/workflow-event.dto';
import { TransitionName, Transitions } from './transitions';

// As string literal so policies don't have to import enum
type Status = `${ProgressReportStatus}`;

@Granter(Event)
export class ProgressReportWorkflowEventGranter extends ResourceGranter<
  typeof Event
> {
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
    return this.transitions(keys(Transitions)).execute;
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

class TransitionCondition implements Condition<typeof Event> {
  private readonly allowedTransitionIds;

  constructor(allowedTransitions: readonly ID[]) {
    this.allowedTransitionIds = new Set(allowedTransitions);
  }

  static fromName(allowedTransitions: readonly TransitionName[]) {
    return new TransitionCondition(
      allowedTransitions.map((t) => Transitions[t].id)
    );
  }

  static fromEndStatus(statuses: readonly Status[]) {
    const allowed = new Set(statuses);
    return new TransitionCondition(
      Object.values(Transitions)
        .filter((t) => allowed.has(t.to))
        .map((t) => t.id)
    );
  }

  isAllowed({ object }: IsAllowedParams<typeof Event>) {
    if (!object) {
      // We are expecting to be called without an object sometimes.
      // These should be treated as false without error.
      return false;
    }
    const transitionId = object.transition;
    if (!transitionId) {
      return false;
    }
    return this.allowedTransitionIds.has(
      isIdLike(transitionId) ? transitionId : transitionId.id
    );
  }

  asCypherCondition(query: Query) {
    // TODO bypasses to statuses won't work with this. How should these be filtered?
    const required = query.params.addParam(
      this.allowedTransitionIds,
      'allowedTransitions'
    );
    return `node.transition IN ${String(required)}`;
  }
}

declare module '../../authorization/policy/granters' {
  interface GrantersOverride {
    ProgressReportWorkflowEvent: ProgressReportWorkflowEventGranter;
  }
}
