import { groupBy } from '@seedcompany/common';
import { mapOrElse } from '~/common';
import {
  all,
  AndConditions,
  any,
  Condition,
  Optimizer,
  OrConditions,
} from '../../policy/conditions';
import { VariantCondition } from './variant.condition';

@Optimizer.register()
export class VariantAndExpUnionOptimizer implements Optimizer {
  optimize(input: Condition) {
    if (!(input instanceof OrConditions)) {
      return input;
    }
    const [toMerge, remaining] = mapOrElse(
      input.conditions,
      (condition, { ELSE }) => this.isVariantAndX(condition) ?? ELSE,
    );

    const groupedByX = groupBy(toMerge, (c) => c.xId);

    if (!groupedByX.some((s) => s.length > 1)) {
      // If no groups to merge, then maintain condition identity
      return input;
    }

    const merged = groupedByX.map((group) => {
      const { variant, x } = group[0]!;
      const variants = variant.union(group.map((c) => c.variant));
      return all(x, variants);
    });

    return any(...remaining, ...merged);
  }

  isVariantAndX(condition: Condition) {
    if (
      !(condition instanceof AndConditions) ||
      condition.conditions.length !== 2
    ) {
      return null;
    }
    const variantIdx = condition.conditions.findIndex(
      (cc) => cc instanceof VariantCondition,
    );
    if (variantIdx === -1) {
      return null;
    }
    const variant = condition.conditions[variantIdx] as VariantCondition<any>;
    const x = condition.conditions[variantIdx === 0 ? 1 : 0];
    const xId = Condition.id(x);
    return { variant, x, xId };
  }
}
