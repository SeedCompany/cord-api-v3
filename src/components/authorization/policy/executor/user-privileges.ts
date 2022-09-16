import { EnhancedResource, ResourceShape, Session } from '~/common';
import { Powers as Power } from '../../index';
import { MissingPowerException } from '../../missing-power.exception';
import { PolicyExecutor } from './policy-executor';
import { ScopedPrivileges } from './scoped-privileges';

export class UserPrivileges {
  constructor(
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  for<TResourceStatic extends ResourceShape<any>>(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    object?: TResourceStatic['prototype']
  ) {
    return new ScopedPrivileges(
      resource,
      object,
      this.session,
      this.policyExecutor
    );
  }

  /**
   * I think this should be replaced in app code with `.for(X).verifyCan('create')`
   */
  verifyPower(power: Power) {
    if (!this.powers.has(power)) {
      throw new MissingPowerException(
        power,
        `User ${
          this.session.anonymous ? 'anon' : this.session.userId
        } does not have the requested power: ${power}`
      );
    }
  }

  get powers(): Set<Power> {
    const policies = this.policyExecutor.getPolicies(this.session);
    return new Set(policies.flatMap((policy) => [...policy.powers]));
  }
}
