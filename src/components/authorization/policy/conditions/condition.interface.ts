/* eslint-disable @typescript-eslint/method-signature-style */
import { Query } from 'cypher-query-builder';
import { EnhancedResource, ResourceShape } from '~/common';
import { Policy } from '../policy.factory';

export interface IsAllowedParams<TResourceStatic extends ResourceShape<any>> {
  object: TResourceStatic['prototype'];

  /**
   * The resource this condition is attached too.
   */
  // This should be EnhancedResource<TResourceStatic>.
  // I can't figure out why TS is having a hard time with it.
  resource: EnhancedResource<any>;
}

export interface Condition<TResourceStatic extends ResourceShape<any>> {
  isAllowed(params: IsAllowedParams<TResourceStatic>): boolean;

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
  setupCypherContext?(query: Query, prevApplied: Set<any>): Query;

  /**
   * DB query where clause fragment that represents the condition.
   */
  asCypherCondition(query: Query): string;
}
