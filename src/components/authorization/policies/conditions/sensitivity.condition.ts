import { ResourceShape, Sensitivity } from '~/common';
import { Condition, IsAllowedParams } from '../../policy/conditions';

const sensitivityRank = { High: 3, Medium: 2, Low: 1 };

export class SensitivityCondition<
  TResourceStatic extends ResourceShape<any> & {
    // Enforcing at TS level that resource needs a sensitivity prop to use this condition.
    prototype: { sensitivity: Sensitivity };
  }
> implements Condition<TResourceStatic>
{
  constructor(private readonly access: Sensitivity) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB which cannot be verified.
    if (!object) {
      throw new Error("Needed object's sensitivity but object wasn't given");
    }
    if (!object.sensitivity) {
      throw new Error(
        "Needed object's sensitivity but object's sensitivity wasn't given"
      );
    }

    return (
      sensitivityRank[this.access] >
      sensitivityRank[object.sensitivity as Sensitivity]
    );
  }
}

/**
 * The following actions only apply if the object's sensitivity is Medium or Low.
 */
export const sensMediumOrLower = new SensitivityCondition(Sensitivity.Medium);

/**
 * The following actions only apply if the object's sensitivity is Low.
 */
export const sensOnlyLow = new SensitivityCondition(Sensitivity.Low);
