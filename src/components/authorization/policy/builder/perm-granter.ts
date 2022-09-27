import { mapFromList, ResourceShape } from '~/common';
import { all, any, Condition } from '../conditions';

export type Permissions<TAction extends string> = {
  readonly [A in TAction]?: Permission;
};
export type Permission = Condition<any> | true;

export abstract class PermGranter<
  TResourceStatic extends ResourceShape<any>,
  TAction extends string
> {
  protected constructor(
    protected stagedCondition?: Condition<TResourceStatic>
  ) {}

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
   * Return grant with these actions added.
   * Maybe expose publicly...
   */
  protected action(...actions: TAction[]): this {
    const cloned = this.clone();
    cloned.conditionWithoutAction = false;
    const perm = cloned.stagedCondition ?? true;
    cloned.perms = {
      ...cloned.perms,
      ...mapFromList(actions, (action) => [action, perm]),
    };
    return cloned;
  }

  /**
   * Conditionally apply the following actions only when this condition is valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  when(condition: Condition<TResourceStatic>): this {
    const cloned = this.clone();
    cloned.stagedCondition = condition;
    cloned.conditionWithoutAction = true;
    return cloned;
  }

  /**
   * Conditionally apply the following actions only when all of these conditions are valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  whenAll(...conditions: Array<Condition<TResourceStatic>>): this {
    return conditions.length > 0 ? this.when(all(...conditions)) : this;
  }

  /**
   * Conditionally apply the following actions only when any of these conditions are valid.
   *
   * Note this overrides whatever conditions were specified before this.
   */
  whenAny(...conditions: Array<Condition<TResourceStatic>>): this {
    return conditions.length > 0 ? this.when(any(...conditions)) : this;
  }

  /**
   * The preceding conditions no longer apply to the following actions.
   */
  get or(): this {
    const cloned = this.clone();
    cloned.stagedCondition = undefined;
    return cloned;
  }

  protected perms: Permissions<TAction> = {};
  /** Is a conditioned declared without an action. Maybe move to TS */
  protected conditionWithoutAction: boolean;

  protected clone(): this {
    const cloned = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    );
    cloned.perms = { ...this.perms };
    return cloned;
  }
}
