import { node, Query, relation } from 'cypher-query-builder';
import { ISession, Order, PaginationInput } from '../../common';
import { mapping } from './mapping.helper';

export * from './mapping.helper';

export function tryGetEditPerm(
  property: string,
  cypherIdentifierForBaseNode: string
) {
  const perm = property + 'EditPerm';
  return [
    [
      node('requestingUser'),
      relation('in', '', 'member'),
      node('', 'SecurityGroup', {
        active: true,
      }),
      relation('out', '', 'permission', { active: true }),
      node(perm, 'Permission', {
        property,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node(cypherIdentifierForBaseNode),
    ],
  ];
}

export function addPropertyCoalesceWithClause(property: string) {
  return mapping(property, {
    value: `coalesce(${property}.value, null)`,
    canRead: `coalesce(${property}ReadPerm.read, false)`,
    canEdit: `coalesce(${property}EditPerm.edit, false)`,
  });
}

export function matchProperty(
  query: Query,
  cypherIdentifierForBaseNode: string,
  ...names: string[]
) {
  for (const name of names) {
    query
      .optionalMatch(property(name, cypherIdentifierForBaseNode))
      .optionalMatch(tryGetEditPerm(name, cypherIdentifierForBaseNode));
  }
}

export function property(
  property: string,
  cypherIdentifierForBaseNode: string
) {
  const perm = property + 'ReadPerm';
  return [
    node('requestingUser'),
    relation('in', '', 'member'),
    node('', 'SecurityGroup', {
      active: true,
    }),
    relation('out', '', 'permission', { active: true }),
    node(perm, 'Permission', {
      property,
      read: true,
      active: true,
    }),
    relation('out', '', 'baseNode'),
    node(cypherIdentifierForBaseNode),
    relation('out', '', property, { active: true }),
    node(property, 'Property', { active: true }),
  ];
}

/**
 * Returns a list containing the values returned by an expression.
 * Using this function aggregates data by amalgamating multiple records or
 * values into a single list.
 *
 * @param expression An expression returning a set of values.
 * @param as         Output as this variable
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-collect
 */
export const collect = (expression: string, as?: string) =>
  `collect(${expression})` + (as ? ' as ' + as : '');

/**
 * Returns the number of values or rows
 *
 * @param expression       The expression
 * @param options          Function options
 * @param options.distinct Whether the expression should be distinct
 * @param options.as       Output as this variable
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-count
 */
export const count = (
  expression: string,
  options: { distinct?: boolean; as?: string }
) =>
  `count(${options.distinct ? 'DISTINCT ' : ''}${expression})` +
  (options.as ? ' as ' + options.as : '');

// export function createPropertyWithSecurityGroup(
//   property: string,
//   additionalLabel: string,
//   addToAdmin: boolean,
//   addToWriter: boolean,
//   addToReader: boolean
// ) {
//   return [
//     node(''), //
//   ];
// }

export function matchRequestingUser(query: Query, session: ISession) {
  query.match([
    node('requestingUser', 'User', {
      active: true,
      id: session.userId,
    }),
  ]);
}

export function returnWithPropertyClauseForList(property: string) {
  return `
    ${property}: {
      value: ${property}.value
    }
  `;
}

export function listWithObject(props: string[]) {
  let block = ``;
  for (let i = 0; i < props.length; i++) {
    block += returnWithPropertyClauseForList(props[i]);
    if (i + 1 < props.length) {
      block += ',';
    }
  }
  return block;
}

export function list(
  query: Query,
  session: ISession,
  label: string,
  props: string[],
  page: number,
  count: number,
  sort: string,
  order: Order
) {
  query.call(matchRequestingUser, session).match([
    node('requestingUser'),
    relation('in', '', 'member'),
    node('', 'SecurityGroup', {
      active: true,
    }),
    relation('out', '', 'permission', { active: true }),
    node('', 'Permission', {
      property: 'name',
      read: true,
      active: true,
    }),
    relation('out', '', 'baseNode'),
    node('node', label, {
      active: true,
    }),
    relation('out', '', sort, { active: true }),
    node(sort, 'Property', { active: true }),
  ]);

  for (const prop of props) {
    query.optionalMatch(property(prop, 'node'));
  }

  query
    .with(
      `
  {
    id: node.id,
    createdAt: node.createdAt,
    ${listWithObject(props)}
  }
  as node
  `
    )
    .with(`collect(node) as nodes, count(node) as total`)
    .raw(`unwind nodes as node`)
    .return('node, total')
    .orderBy([[`node.${sort}.value`, order]])
    .skip((page - 1) * count)
    .limit(count);
}

export const hasMore = (input: PaginationInput, total: number) =>
  // if skip + count is less than total, there is more
  (input.page - 1) * input.count + input.count < total;
