import { mapFromList, ResourceShape } from '~/common';
import { all, any, Condition } from '../conditions';

export type Permissions<TAction extends string> = {
  readonly [A in TAction]?: Permission;
};
export type Permission = Condition<any> | boolean;

/**
 * Add allowed actions.
 */
export const action = Symbol('PermGranter.action');

/**
 * Add to the perms list.
 */
export const withPerms = Symbol('PermGranter.withPerms');

/**
 * Extract permissions from granter.
 */
export const extract = Symbol('PermGranter.extract');

export abstract class PermGranter<
  TResourceStatic extends ResourceShape<any>,
  TAction extends string
> {
  protected constructor(
    protected stagedCondition?: Condition<TResourceStatic>
  ) {}

  /**
   * Return grant with these actions added.
   */
  [action](...actions: TAction[]): this {
    const perm = this.stagedCondition ?? true;
    return this[withPerms](mapFromList(actions, (action) => [action, perm]));
  }

  [withPerms](...perms: Array<Permissions<TAction>>): this {
    const cloned = this.clone();
    cloned.trailingCondition = undefined;
    cloned.perms = [...cloned.perms, ...perms];
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
    if (process.env.NODE_ENV !== 'production') {
      cloned.trailingCondition = new Error(
        'Condition applies to nothing. Specify before actions.'
      );
      // Find first frame that is not from a Granter call.
      let frame = cloned.trailingCondition
        .stack!.split('\n')
        .find(
          (line) => line.includes(' at ') && !/\s+at \w+Granter\./.exec(line)
        );
      // If frame is the function call of Policy decorator, which it probably is,
      // then remove the useless type/function/method name for clarity.
      if (frame?.startsWith('    at Object.def')) {
        const match = frame.match(/^\s+at .+\((.+)\)$/)!;
        frame = `    at ${match[1]}`;
      }
      cloned.trailingCondition.stack = [
        `Error: ${cloned.trailingCondition.message}`,
        frame ?? '',
      ].join('\n');
    }
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

  [extract]() {
    if (this.trailingCondition) {
      throw this.trailingCondition;
    }
    return {
      perms: this.perms,
    };
  }

  protected perms: ReadonlyArray<Permissions<TAction>> = [];
  /** Is a conditioned declared without an action. Maybe move to TS */
  protected trailingCondition?: Error;

  protected clone(): this {
    const cloned = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this
    );
    cloned.perms = [...this.perms];
    return cloned;
  }
}
