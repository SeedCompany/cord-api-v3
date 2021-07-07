import { stripIndent } from 'common-tags';
import {
  Clause,
  ClauseCollection,
  Create,
  Raw,
  With,
} from 'cypher-query-builder';
import type { PatternClause as TSPatternClause } from 'cypher-query-builder/dist/typings/clauses/pattern-clause';
import type {
  Term,
  TermListClause as TSTermListClause,
} from 'cypher-query-builder/dist/typings/clauses/term-list-clause';
import { compact, map, reduce } from 'lodash';
import { Class } from 'type-fest';
import { isExp } from '../query';

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
// problems with it sometimes.
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

// Strip indents from `with` & `return` clauses.
// Convert CypherExpression proxies to strings, so they are rendered correctly.
const origStringifyTerm = TermListClause.prototype.stringifyTerm;
TermListClause.prototype.stringifyTerm = function stringifyTerm(term: Term) {
  const stripped =
    typeof term === 'string'
      ? stripIndent(term)
      : isExp(term)
      ? term.toString()
      : term;
  return origStringifyTerm.call(this, stripped);
};

// Strip indents from `raw` clauses
Raw.prototype.build = function build() {
  return stripIndent(this.clause);
};

// Remove extra line breaks from empty clauses
ClauseCollection.prototype.build = function build(this: ClauseCollection) {
  const clauses = compact(this.clauses.map((c) => c.build()));
  if (clauses.length === 0) {
    return '';
  }
  return `${clauses.join('\n')};`;
};
