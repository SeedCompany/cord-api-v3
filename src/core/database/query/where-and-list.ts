import {
  ParameterBag,
  Precedence,
  stringCons,
  WhereOp,
} from 'cypher-query-builder';
import { AnyConditions } from 'cypher-query-builder/dist/typings/clauses/where-utils';

export class WhereAndList extends WhereOp {
  constructor(public conditions: AnyConditions[]) {
    super();
  }

  evaluate(params: ParameterBag, precedence = Precedence.None, name = '') {
    // If this operator will not be used, precedence should not be altered
    const newPrecedence =
      this.conditions.length < 2 ? precedence : Precedence.And;
    const strings = this.conditions.map((condition) =>
      stringCons(params, condition, newPrecedence, name),
    );

    const string = strings.join(' AND ');
    const braces = precedence !== 0 && precedence > newPrecedence;
    return braces ? `(${string})` : string;
  }
}
