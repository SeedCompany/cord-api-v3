/* eslint-disable @typescript-eslint/method-signature-style */
import { Many } from '@seedcompany/common';
import { Query } from 'cypher-query-builder';
import { inspect, InspectOptionsStylized } from 'util';
import { EnhancedResource, ResourceShape, Session } from '~/common';
import { ResourceObjectContext } from '../object.type';
import { Policy } from '../policy.factory';

export interface IsAllowedParams<TResourceStatic extends ResourceShape<any>> {
  /**
   * The resource this condition is attached too.
   */
  // This should be EnhancedResource<TResourceStatic>.
  // I can't figure out why TS is having a hard time with it.
  resource: EnhancedResource<any>;

  object?: ResourceObjectContext<TResourceStatic>;

  session: Session;
}

export type AsCypherParams<TResourceStatic extends ResourceShape<any>> = Omit<
  IsAllowedParams<TResourceStatic>,
  'object'
>;

export type AsEdgeQLParams<TResourceStatic extends ResourceShape<any>> = Pick<
  IsAllowedParams<TResourceStatic>,
  'resource'
>;

export abstract class Condition<
  TResourceStatic extends ResourceShape<any> = ResourceShape<any>,
> {
  static id(permission: Condition | boolean) {
    if (typeof permission === 'boolean') {
      return String(permission);
    }
    return inspect(permission, {
      depth: null,
      colors: false,
    });
  }

  abstract isAllowed(params: IsAllowedParams<TResourceStatic>): boolean;

  /**
   * If the condition requires the policy to check if allowed, implement
   * this function.
   * NOTE: It should return a new condition, not this.
   */
  attachPolicy?(policy: Policy): Condition<TResourceStatic>;

  /**
   * Add to the DB query what this condition needs into context.
   *
   * Use `prevApplied` to dedupe logic, like when this type of condition
   * is used multiple times with a query.
   */
  setupCypherContext?(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>,
  ): Query;

  /**
   * DB query where clause fragment that represents the condition.
   */
  abstract asCypherCondition(
    query: Query,
    other: AsCypherParams<TResourceStatic>,
  ): string;

  /**
   * Add with statement aliases.
   */
  setupEdgeQLContext?(
    params: AsEdgeQLParams<TResourceStatic>,
  ): Record<string, string>;

  abstract asEdgeQLCondition(params: AsEdgeQLParams<TResourceStatic>): string;

  /**
   * Union multiple conditions of this type together to a single one.
   * This should not logically change anything, but rather just simplify unnecessary conditions.
   * Note: The current context, this, should not be used.
   */
  union?(
    this: void,
    conditions: readonly this[],
  ): Many<Condition<TResourceStatic>>;

  /**
   * Intersect multiple conditions of this type together to a single one.
   * This should not logically change anything, but rather just simplify unnecessary conditions.
   * Note: The current context, this, should not be used.
   */
  intersect?(
    this: void,
    conditions: readonly this[],
  ): Many<Condition<TResourceStatic>>;

  /**
   * Stringify the condition.
   * This is used to uniquely identify the condition.
   * And is what is displayed in dumper/debugger.
   */
  abstract [inspect.custom](
    depth: number,
    options: InspectOptionsStylized,
  ): string;
}
