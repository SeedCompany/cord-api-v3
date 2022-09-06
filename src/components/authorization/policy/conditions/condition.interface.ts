import { ResourceShape } from '~/common';
import { Policy } from '../policy.factory';

export interface IsAllowedParams<TResourceStatic extends ResourceShape<any>> {
  object: TResourceStatic['prototype'];
  resource: TResourceStatic;
  policy: Policy;
}

export interface Condition<TResourceStatic extends ResourceShape<any>> {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  isAllowed(params: IsAllowedParams<TResourceStatic>): boolean;
}
