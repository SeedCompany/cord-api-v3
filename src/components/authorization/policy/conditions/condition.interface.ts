/* eslint-disable @typescript-eslint/method-signature-style */
import { Query } from 'cypher-query-builder';
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
  setupCypherContext?(
    query: Query,
    prevApplied: Set<any>,
    other: AsCypherParams<TResourceStatic>
  ): Query;

  /**
   * DB query where clause fragment that represents the condition.
   */
  asCypherCondition(
    query: Query,
    other: AsCypherParams<TResourceStatic>
  ): string;
}
