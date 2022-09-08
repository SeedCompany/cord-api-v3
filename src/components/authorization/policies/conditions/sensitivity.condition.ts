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
    const actual: Sensitivity | undefined =
      object[EffectiveSensitivity] ?? object.sensitivity;

    if (!actual) {
      throw new Error(
        "Needed object's sensitivity but object's sensitivity wasn't given"
      );
    }

    return sensitivityRank[this.access] >= sensitivityRank[actual];
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

/**
 * Specify sensitivity that should be used for the sensitivity condition.
 * This is useful when the object doesn't have a `sensitivity` property or
 * a different/"effective" sensitivity should be used for this logic.
 */
export const withEffectiveSensitivity = <T extends object>(
  obj: T,
  sensitivity: Sensitivity
): T =>
  Object.defineProperty(obj, EffectiveSensitivity, {
    value: sensitivity,
    enumerable: false,
  });

const EffectiveSensitivity = Symbol('EffectiveSensitivity');
