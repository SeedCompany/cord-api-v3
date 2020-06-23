import { node, Query, relation } from 'cypher-query-builder';
import {
  ISession,
  PaginationInput,
  SortablePaginationInput,
} from '../../common';
import { ILogger } from '../../core';
import { mapping } from './mapping.helper';

export * from './mapping.helper';

export function printActualQuery(logger: ILogger, query: Query) {
  const printMe = query;
  logger.info(printMe.interpolate());
}

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
  return mapping(property, securedProperty(property));
}

export const securedProperty = (property: string) => ({
  value: coalesce(`${property}.value`),
  canRead: coalesce(`${property}ReadPerm.read`, false),
  canEdit: coalesce(`${property}EditPerm.edit`, false),
});

export function matchProperties(
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

/**
 * Returns the first non-null value in the given list of expressions.
 *
 * `null` will be returned if all the arguments are `null`.
 *
 * @param expressions An expression which may return null.
 * @see https://neo4j.com/docs/cypher-manual/current/functions/aggregating/#functions-coalesce
 */
export const coalesce = (...expressions: any[]) =>
  `coalesce(${expressions.join(', ')})`;

export function matchRequestingUser(query: Query, session: ISession) {
  query.match([
    node('requestingUser', 'User', {
      active: true,
      id: session.userId,
    }),
  ]);
}

export function returnWithSecurePropertyClauseForList(property: string) {
  return `
    ${property}: {
      value: coalesce(${property}.value, null),
      canRead: coalesce(${property}ReadPerm.read, false),
      canEdit: coalesce(${property}EditPerm.edit, false)
    }
  `;
}

export function returnWithUnsecurePropertyClauseForList(property: string) {
  return `
    ${property}: coalesce(${property}.value, null)
  `;
}

export function listWithUnsecureObject(props: string[]) {
  let block = ``;
  for (let i = 0; i < props.length; i++) {
    block += returnWithUnsecurePropertyClauseForList(props[i]);
    if (i + 1 < props.length) {
      block += ',';
    }
  }
  return block;
}

export function listWithSecureObject(props: string[]) {
  let block = ``;
  for (let i = 0; i < props.length; i++) {
    block += returnWithSecurePropertyClauseForList(props[i]);
    if (i + 1 < props.length) {
      block += ',';
    }
  }
  return block;
}

export function addBaseNodeMetaPropsWithClause(props: string[]) {
  let block = ``;
  for (let i = 0; i < props.length; i++) {
    block += `${props[i]}: node.${props[i]}`;
    if (i + 1 < props.length) {
      block += ',';
    }
  }
  return block;
}

export function filterQuery(
  query: Query,
  label: string,
  sort: string,
  baseNodeId?: string,
  baseNodeLabel?: string,
  childNodeIdentifier?: string
) {
  if (baseNodeId && baseNodeLabel) {
    query.match([
      node('requestingUser'),
      relation('in', '', 'member'),
      node('', 'SecurityGroup', {
        active: true,
      }),
      relation('out', '', 'permission', { active: true }),
      node('', 'Permission', {
        property: childNodeIdentifier,
        read: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('parentNode', baseNodeLabel, {
        active: true,
        id: baseNodeId,
      }),
      relation('out', '', childNodeIdentifier, {
        active: true,
      }),
      node('node', label, {
        active: true,
      }),
      relation('out', '', sort, { active: true }),
      node(sort, 'Property', { active: true }),
    ]);
  } else {
    query.match([
      node('requestingUser'),
      relation('in', '', 'member'),
      node('', 'SecurityGroup', {
        active: true,
      }),
      relation('out', '', 'permission', { active: true }),
      node('', 'Permission', {
        property: sort,
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
  }
}

export function listReturnBlock(
  query: Query,
  { page, count, sort, order }: SortablePaginationInput
) {
  query
    .with(`collect(distinct node) as nodes, count(distinct node) as total`)
    .raw(`unwind nodes as node`)
    .returnDistinct('node, total')
    .orderBy([[`node.${sort}.value`, order]])
    .skip((page - 1) * count)
    .limit(count);
}

export const onePage = (query: Query, input: PaginationInput) =>
  query.skip((input.page - 1) * input.count).limit(input.count);

export const hasMore = (input: PaginationInput, total: number) =>
  // if skip + count is less than total, there is more
  (input.page - 1) * input.count + input.count < total;
