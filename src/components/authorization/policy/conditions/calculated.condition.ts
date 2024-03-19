import { Condition } from './condition.interface';

export class CalculatedCondition implements Condition {
  static readonly instance = new CalculatedCondition();
  isAllowed() {
    return false;
  }
  asCypherCondition() {
    return 'false';
  }
}
