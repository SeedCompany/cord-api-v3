import { ClauseCollection, Query } from 'cypher-query-builder';

export class SubClauseCollection extends ClauseCollection {
  build() {
    return this.clauses
      .map((clause) => `  ${clause.build()}`.replace(/\n/g, `\n  `))
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
