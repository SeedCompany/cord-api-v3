import { inspect } from 'util';
import { type Condition } from './condition.interface';

export class CalculatedCondition implements Condition {
  static readonly instance = new CalculatedCondition();
  isAllowed() {
    return false;
  }
  [inspect.custom]() {
    return 'Calculated';
  }
}
