/* eslint-disable @typescript-eslint/method-signature-style */
import { ResourceShape } from '~/common';
import { Policy } from '../policy.factory';

export interface IsAllowedParams<TResourceStatic extends ResourceShape<any>> {
  object: TResourceStatic['prototype'];
  resource: TResourceStatic;
}

export interface Condition<TResourceStatic extends ResourceShape<any>> {
  isAllowed(params: IsAllowedParams<TResourceStatic>): boolean;

  /**
   * If the condition requires the policy to check if allowed, implement
   * this function.
   * NOTE: It should return a new condition, not this.
   */
  attachPolicy?(policy: Policy): Condition<TResourceStatic>;
}
