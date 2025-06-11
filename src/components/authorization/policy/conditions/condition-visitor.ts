import { AggregateConditions } from './aggregate.condition';
import { type Condition } from './condition.interface';

export const visitCondition = (condition: Condition, iteratee: (node: Condition) => void): void => {
  iteratee(condition);
  if (condition instanceof AggregateConditions) {
    for (const c of condition.conditions) {
      visitCondition(c, iteratee);
    }
  }
};
