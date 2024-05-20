import { AndConditions, OrConditions } from './aggregate.condition';
import { Condition } from './condition.interface';
import { Optimizer } from './optimizer.interface';

@Optimizer.register()
export class FlattenAggregateOptimizer implements Optimizer {
  optimize(input: Condition) {
    if (
      input instanceof AndConditions &&
      input.conditions.some((c) => c instanceof AndConditions)
    ) {
      return AndConditions.from(
        ...input.conditions.flatMap((c) =>
          c instanceof AndConditions ? c.conditions : c,
        ),
      );
    }
    if (
      input instanceof OrConditions &&
      input.conditions.some((c) => c instanceof OrConditions)
    ) {
      return OrConditions.from(
        ...input.conditions.flatMap((c) =>
          c instanceof OrConditions ? c.conditions : c,
        ),
      );
    }
    return input;
  }
}
