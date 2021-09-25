/**
 * This file patches pattern conditions to support referencing existing variables.
 * This is achieved by wrapping the variable name in a `variable()` call.
 */
import { Clause, NodePattern } from 'cypher-query-builder';
import type { Pattern as TSPattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import type {
  Parameter as TSParameter,
  ParameterBag as TSParameterBag,
} from 'cypher-query-builder/dist/typings/parameter-bag';
import type { ParameterContainer as TSParameterContainer } from 'cypher-query-builder/dist/typings/parameter-container';
import { Class } from 'type-fest';
import { many, Many, mapFromList } from '../../../common';

// This class is not exported so grab it a hacky way
const ParameterContainer = Object.getPrototypeOf(
  Clause
) as Class<TSParameterContainer>;
const ParameterBag = new ParameterContainer().getParameterBag()
  .constructor as Class<TSParameterBag>;
const Parameter = new ParameterBag().addParam('')
  .constructor as Class<TSParameter>;
const Pattern = Object.getPrototypeOf(NodePattern) as Class<TSPattern>;

export class Variable extends Parameter {
  constructor(variable: string, public refs: readonly string[]) {
    super(variable, variable);
  }

  toString() {
    return `${this.name}`;
  }
}

/**
 * @param expression The expression to inline in the query
 * @param refs References used in the expression.
 *             Can be used to import them into sub-queries.
 */
export const variable = (expression: string, refs?: Many<string>) =>
  new Variable(expression, refs ? many(refs) : []);

ParameterBag.prototype.addParam = function addParam(
  this: TSParameterBag,
  value: any | Variable,
  name?: string
) {
  if (value instanceof Variable) {
    this.parameterMap[value.name] = value;
    return value;
  }
  const actualName = this.getName(name);
  const param = new Parameter(actualName, value);
  this.parameterMap[actualName] = param;
  return param;
};

ParameterBag.prototype.addExistingParam = function addExistingParam(
  this: TSParameterBag,
  param: TSParameter
) {
  if (param instanceof Variable) {
    this.parameterMap[param.name] = param;
    return param;
  }
  param.name = this.getName(param.name);
  this.parameterMap[param.name] = param;
  return param;
};

ParameterBag.prototype.getParams = function getParams(this: TSParameterBag) {
  return mapFromList(Object.entries(this.parameterMap), ([name, param]) =>
    param instanceof Variable ? null : ([name, param.value] as const)
  );
};

Pattern.prototype.setExpandedConditions = function (
  this: TSPattern,
  expanded: boolean
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
