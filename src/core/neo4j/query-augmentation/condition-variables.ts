/**
 * This file patches pattern conditions to support referencing existing variables.
 * This is achieved by wrapping the variable name in a `variable()` call.
 */
import { Parameter, ParameterBag, Pattern } from 'cypher-query-builder';

export class Variable extends Parameter {
  constructor(variable: string) {
    super('variable', String(variable));
  }

  toString() {
    return this.value;
  }
}

/**
 * @param expression The expression to inline in the query
 */
export const variable = (expression: string) => new Variable(expression);

// eslint-disable-next-line @typescript-eslint/unbound-method
const origAddParam = ParameterBag.prototype.addParam;
ParameterBag.prototype.addParam = function addParam(
  this: ParameterBag,
  value: any | Variable,
  name?: string,
) {
  return value instanceof Variable
    ? value
    : origAddParam.call(this, value, name);
};

Pattern.prototype.setExpandedConditions = function (
  this: Pattern,
  expanded: boolean,
) {
  if (this.useExpandedConditions !== expanded) {
    // If trying to join conditions into a single parameter check if there are any variables being referenced.
    // If so, ignore this as we need it expanded for query to be correct.
    if (
      !expanded &&
      Object.values(this.conditions).some((cond) => cond instanceof Variable)
    ) {
      return;
    }
    this.useExpandedConditions = expanded;
    this.rebindConditionParams();
  }
};
