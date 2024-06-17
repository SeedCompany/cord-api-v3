import { Clause, ClauseCollection, Query } from 'cypher-query-builder';
import type { ParameterBag } from 'cypher-query-builder/dist/typings/parameter-bag';

export class SubClauseCollection extends ClauseCollection {
  useParameterBag(newBag: ParameterBag) {
    super.useParameterBag(newBag);
    this.assignBagRecursive(this, newBag);
  }

  private assignBagRecursive(clause: Clause, newBag: ParameterBag) {
    // @ts-expect-error protected, but we want it to reference the outer one
    // without having to import the parameters.
    clause.parameterBag = newBag;
    if (clause instanceof ClauseCollection) {
      for (const sub of clause.getClauses()) {
        this.assignBagRecursive(sub, newBag);
      }
    }
  }

  build() {
    return this.clauses
      .flatMap((clause) => {
        const built = clause.build();
        return built ? `  ${built}`.replace(/\n/g, `\n  `) : [];
      })
      .join('\n');
  }

  protected wrapBuild(prefix: string, suffix: string, clauses: string) {
    const multiline = clauses.includes('\n') || clauses.length > 80;
    return multiline
      ? [prefix.trim(), clauses, suffix.trim()].join('\n')
      : [prefix, clauses.trim(), suffix].join('');
  }

  asQuery() {
    const query = new Query();
    // @ts-expect-error We are also a ClauseCollection, so it's all good.
    query.clauses = this;
    return query;
  }
}
