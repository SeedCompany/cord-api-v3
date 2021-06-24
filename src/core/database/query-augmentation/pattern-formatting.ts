import {
  ClauseCollection,
  Create,
  Match,
  Merge,
  With,
} from 'cypher-query-builder';
import type { TermListClause as TSTermListClause } from 'cypher-query-builder/dist/typings/clauses/term-list-clause';
import { compact } from 'lodash';
import { Class } from 'type-fest';

// Add line breaks for each pattern when there's multiple per statement
for (const Cls of [Match, Create, Merge]) {
  const origBuild = Cls.prototype.build;
  Cls.prototype.build = function build() {
    const str = origBuild.call(this);
    return str.split(', ').join(',\n    ');
  };
}

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
