import { stripIndent } from 'common-tags';
import {
  Clause,
  ClauseCollection,
  Create,
  Match,
  Merge,
  Raw,
  Return,
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
// And ignore empty patterns
const PatternClause = Object.getPrototypeOf(Create) as Class<TSPatternClause>;
PatternClause.prototype.build = function build() {
  const patternStrings = map(this.patterns, (pattern) =>
    reduce(pattern, (str: string, clause: Clause) => str + clause.build(), '')
  );
  return compact(patternStrings).join(',\n    ');
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
  // Remove empty strings, so they don't cause problems with double commas
  if (!stripped) {
    return [];
  }
  return origStringifyTerm.call(this, stripped);
};

// If the term list clause has no terms render empty string instead of broken cypher
for (const Cls of [With, Return]) {
  const origBuild = Cls.prototype.build;
  Cls.prototype.build = function build(this: TSTermListClause) {
    if (TermListClause.prototype.build.call(this) === '') {
      return '';
    }
    return origBuild.call(this);
  };
}

// Strip indents from `raw` clauses
Raw.prototype.build = function build() {
  return stripIndent(this.clause);
};

// If the pattern clause has no patterns render empty string instead of broken cypher
for (const Cls of [Match, Create, Merge]) {
  const origBuild = Cls.prototype.build;
  Cls.prototype.build = function build(this: TSPatternClause) {
    if (PatternClause.prototype.build.call(this) === '') {
      return '';
    }
    return origBuild.call(this);
  };
}

// Remove extra line breaks from empty clauses
ClauseCollection.prototype.build = function build(this: ClauseCollection) {
  const clauses = compact(this.clauses.map((c) => c.build()));
  if (clauses.length === 0) {
    return '';
  }
  return `${clauses.join('\n')};`;
};
