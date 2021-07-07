import { Clause, ClauseCollection, Create, With } from 'cypher-query-builder';
import type { PatternClause as TSPatternClause } from 'cypher-query-builder/dist/typings/clauses/pattern-clause';
import type { TermListClause as TSTermListClause } from 'cypher-query-builder/dist/typings/clauses/term-list-clause';
import { compact, map, reduce } from 'lodash';
import { Class } from 'type-fest';

// Add line breaks for each pattern when there's multiple per statement
const PatternClause = Object.getPrototypeOf(Create) as Class<TSPatternClause>;
PatternClause.prototype.build = function build() {
  const patternStrings = map(this.patterns, (pattern) =>
    reduce(pattern, (str: string, clause: Clause) => str + clause.build(), '')
  );
  return patternStrings.join(',\n    ');
};

// This class is not exported so grab it a hacky way
const TermListClause = Object.getPrototypeOf(With) as Class<TSTermListClause>;

// Change With & Return clauses to not alias as same variable since cypher as
// problems with it some times.
// e.g. .with({ node: 'node' })
// WITH node as node
// Neo4jError: key not found: SymbolUse(node@821)
const origStringifyProperty = TermListClause.prototype.stringifyProperty;
TermListClause.prototype.stringifyProperty = function stringifyProperty(
  prop: string,
  alias?: string,
  node?: string
) {
  if (prop === alias && !node) {
    return prop;
  }
  return origStringifyProperty(prop, alias, node);
};

// Remove extra line breaks from empty clauses
ClauseCollection.prototype.build = function build(this: ClauseCollection) {
  const clauses = compact(this.clauses.map((c) => c.build()));
  if (clauses.length === 0) {
    return '';
  }
  return `${clauses.join('\n')};`;
};
