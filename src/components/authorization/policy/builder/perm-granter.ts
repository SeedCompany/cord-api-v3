import { mapFromList, ResourceShape } from '~/common';
import { AndConditions, Condition, OrConditions } from '../conditions';

export type Action = 'read' | 'write' | 'create' | 'delete';

export type Permissions = Readonly<Partial<Record<Action, Permission>>>;
export type Permission = Condition<any> | true;

export abstract class PermGranter<TResourceStatic extends ResourceShape<any>> {
  /**
   * The requester can do nothing with this prop or object.
   *
   * This is not a DENY action. It can be overridden by another entry
   * in the same or even different policy.
   *
   * This does provide logical value when you want to:
   * - Exclude a certain prop from object level actions.
   * - Exclude an implementation from actions defined for an interface.
   */
  get none() {
    return this;
  }

  /**
   * The requester can read this prop or object.
   */
  get read() {
    return this.withAddedAction('read');
  }
  /**
   * The requester can read & modify this prop or object.
   */
  get write() {
    return this.withAddedAction('read', 'write');
  }

  /**
   * Conditionally apply the following actions only when this condition is valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  when(condition: Condition<TResourceStatic>) {
    return this.whenAll(condition);
  }

  /**
   * Conditionally apply the following actions only when all of these conditions are valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  whenAll(...conditions: Array<Condition<TResourceStatic>>) {
    if (conditions.length === 0) return this;
    const cloned = this.clone();
    cloned.stagedCondition =
      conditions.length > 1 ? new AndConditions(conditions) : conditions[0];
    cloned.conditionWithoutAction = true;
    return cloned;
  }

  /**
   * Conditionally apply the following actions only when any of these conditions are valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  whenAny(...conditions: Array<Condition<TResourceStatic>>) {
    if (conditions.length === 0) return this;
    const cloned = this.clone();
    cloned.stagedCondition =
      conditions.length > 1 ? new OrConditions(conditions) : conditions[0];
    cloned.conditionWithoutAction = true;
    return cloned;
  }

  /**
   * The preceding conditions no longer apply to the following actions.
   */
  get or() {
    const cloned = this.clone();
    cloned.stagedCondition = undefined;
    return cloned;
  }

  protected perms: Permissions = {};
  protected stagedCondition?: Condition<TResourceStatic>;
  /** Is a conditioned declared without an action. Maybe move to TS */
  protected conditionWithoutAction: boolean;

  protected abstract newThis(): this;

  protected clone(): this {
    const cloned = this.newThis();
    cloned.perms = { ...this.perms };
    cloned.stagedCondition = this.stagedCondition;
    return cloned;
  }
  protected withAddedAction(...actions: Action[]) {
    const cloned = this.clone();
    cloned.conditionWithoutAction = false;
    const perm = cloned.stagedCondition ?? true;
    cloned.perms = {
      ...cloned.perms,
      ...mapFromList(actions, (action) => [action, perm]),
    };
    return cloned;
  }
}
