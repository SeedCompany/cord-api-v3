import { entries } from '@seedcompany/common';
import { Clause, Query } from 'cypher-query-builder';
import { Parameter } from 'cypher-query-builder/dist/typings/parameter-bag';
import { isExp, variable } from '../query';
import type { YieldTerms } from './yield';

declare module 'cypher-query-builder/dist/typings/query' {
  interface Query {
    /**
     * Call a procedure.
     *
     * Args can be an array of positional args, or an object of named args.
     * Objects are still converted to positional args, so the order matters.
     * Objects allow the query parameters to be named for better readability.
     */
    call(procedure: ProcedureCall): this;
    call(procedureName: string, args?: ProcedureArgs): this;
  }
}

Query.prototype.call = function call(
  this: Query,
  procedure: ProcedureCall | string,
  args?: ProcedureArgs,
) {
  const call =
    typeof procedure === 'string'
      ? { procedureName: procedure, args: args ?? [] }
      : procedure;
  const clause = new Procedure(call.procedureName, call.args);
  const next = this.continueChainClause(clause);
  return call.yieldTerms ? next.yield(call.yieldTerms) : next;
};

interface ProcedureCall<Y extends string = string> {
  procedureName: string;
  args: ProcedureArgs;
  yieldTerms?: YieldTerms<Y>;
}
type ProcedureArgs = Record<string, any> | any[];

class Procedure extends Clause {
  private readonly params: Parameter[];
  constructor(public name: string, public args: Record<string, any> | any[]) {
    super();
    this.params = (
      Array.isArray(args)
        ? args.map((value) => [undefined, value] as const)
        : entries(this.args as Record<string, any>)
    ).map(([key, value]) =>
      isExp(value) ? variable(value) : this.addParam(value, key),
    );
  }
  build() {
    return `CALL ${this.name}(${this.params.join(', ')})`;
  }
}

export const procedure =
  <const Y extends string>(
    procedureName: string,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    yieldDefs: readonly Y[],
  ) =>
  (args: ProcedureArgs) => ({
    procedureName,
    args,
    yield: (yieldTerms: YieldTerms<Y>) =>
      Object.assign(
        (query: Query) => query.call(procedureName, args).yield(yieldTerms),
        {
          procedureName,
          args,
          yieldTerms,
        },
      ),
  });
