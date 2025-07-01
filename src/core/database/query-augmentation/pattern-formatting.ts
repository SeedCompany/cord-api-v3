import { isNotFalsy, isPlainObject } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import {
  type Clause,
  ClauseCollection,
  Create,
  Match,
  Merge,
  NodePattern,
  PatternClause,
  Raw,
  Return,
  TermListClause,
  Where,
  With,
} from 'cypher-query-builder';
import type { Term } from 'cypher-query-builder/dist/typings/clauses/term-list-clause';
import type { Parameter } from 'cypher-query-builder/dist/typings/parameter-bag';
import { camelCase } from 'lodash';
import { isExp } from '../query';
import { WhereAndList } from '../query/where-and-list';

// Add line breaks for each pattern when there is multiple per statement
// And ignore empty patterns
PatternClause.prototype.build = function build() {
  const patternStrings = this.patterns.map((pattern) =>
    pattern.reduce((str: string, clause: Clause) => str + clause.build(), ''),
  );
  return patternStrings.filter(isNotFalsy).join(',\n    ');
};

// Change With & Return clauses to not alias as same variable since cypher as
// problems with it sometimes.
// e.g. .with({ node: 'node' })
// WITH node as node
// Neo4jError: key not found: SymbolUse(node@821)
// @ts-expect-error private but we are calling it
const origStringifyProperty = TermListClause.prototype.stringifyProperty;
// @ts-expect-error private but we are replacing it
TermListClause.prototype.stringifyProperty = function stringifyProperty(
  prop: string,
  alias?: string,
  node?: string,
) {
  if (prop === alias && !node) {
    return prop;
  }
  return origStringifyProperty(prop, alias, node);
};

// Strip indents from `with` & `return` clauses.
// Convert CypherExpression proxies to strings, so they are rendered correctly.
// @ts-expect-error private but we are calling it
const origStringifyTerm = TermListClause.prototype.stringifyTerm;
// @ts-expect-error private but we are replacing it
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
  Cls.prototype.build = function build(this: TermListClause) {
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
  Cls.prototype.build = function build(this: PatternClause) {
    if (PatternClause.prototype.build.call(this) === '') {
      return '';
    }
    return origBuild.call(this);
  };
}

ClauseCollection.prototype.addClause = function addClause(
  this: ClauseCollection,
  clause: Clause,
) {
  // Merge sibling where clauses into a single where clause
  if (clause instanceof Where && this.clauses.at(-1) instanceof Where) {
    const prev = this.clauses.at(-1) as Where;
    prev.conditions = new WhereAndList([prev.conditions, clause.conditions]);
    return;
  }

  clause.useParameterBag(this.parameterBag);
  this.clauses.push(clause);
};

// Remove extra line breaks from empty clauses
ClauseCollection.prototype.build = function build(this: ClauseCollection) {
  const clauses = this.clauses.map((c) => c.build()).filter(isNotFalsy);
  if (clauses.length === 0) {
    return '';
  }
  return `${clauses.join('\n')};`;
};

// Add rule to name "id" parameters like their node labels for better DX
// (:User { id: "" }) -> $userId instead of $id
// eslint-disable-next-line @typescript-eslint/unbound-method
const origRebind = NodePattern.prototype.rebindConditionParams;
NodePattern.prototype.rebindConditionParams = function rebindConditionParams(
  this: NodePattern,
) {
  origRebind.call(this);
  const params = isPlainObject(this.conditionParams)
    ? (this.conditionParams as Record<string, Parameter>)
    : {};
  if (params.id?.name.startsWith('id') && this.labels.length > 0) {
    params.id.name = camelCase(`${this.labels[0]!} ${params.id.name}`);
  }
};
