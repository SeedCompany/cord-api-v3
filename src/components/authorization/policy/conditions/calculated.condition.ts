import { ServerException } from '~/common';
import { Condition } from './condition.interface';

export class CalculatedCondition implements Condition {
  static readonly instance = new CalculatedCondition();
  isAllowed() {
    return false;
  }
  asCypherCondition(): never {
    throw new ServerException(
      'Action is calculated, it should not be going to Cypher',
    );
  }
  asEdgeQLCondition(): never {
    throw new ServerException(
      'Action is calculated, it should not be going to EdgeQL',
    );
  }
}
