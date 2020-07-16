import {
  contains,
  inArray,
  node,
  Query,
  regexp,
  relation,
} from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { isFunction } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  ISession,
  PaginationInput,
  SortablePaginationInput,
} from '../../common';
import { ILogger } from '../logger';
import { mapping } from './mapping.helper';

export * from './mapping.helper';

export function printActualQuery(logger: ILogger, query: Query) {
  const printMe = query;
  logger.info(printMe.interpolate());
}

// eslint-disable-next-line @seedcompany/no-unused-vars
function printQueryInConsole(query: Query) {
  const printMe = query;
  // eslint-disable-next-line no-console
  console.log(printMe.interpolate());
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
  return props
    .map((x) => returnWithUnsecurePropertyClauseForList(x))
    .join(', ');
}

export function listWithSecureObject(props: string[]) {
  return props.map((x) => returnWithSecurePropertyClauseForList(x)).join(', ');
}

export function addBaseNodeMetaPropsWithClause(props: string[]) {
  return props.map((x) => `${x}: node.${x}`).join(', ');
}

export function filterQuery(
  query: Query,
  label: string,
  sort: string,
  baseNodeId?: string,
  baseNodeLabel?: string,
  childNodeIdentifier?: string,
  filterKey?: string,
  filterValue?: string
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
  } else if (filterKey && filterValue) {
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
      node(filterKey, 'Property', { active: true }),
    ]);
    query.where({
      [filterKey]: { value: contains(filterValue) },
    });
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

export function listReturnBlock<T = any>(
  query: Query,
  { page, count, sort: sortInput, order }: SortablePaginationInput,
  sort?: string | ((sortStr: string) => string)
) {
  query
    .with(['collect(distinct node) as nodes', 'count(distinct node) as total'])
    .raw(`unwind nodes as node`)
    .with(['node', 'total'])
    .orderBy(
      sort
        ? isFunction(sort)
          ? sort(sortInput)
          : sort
        : `node.${sortInput}.value`,
      order
    )
    .with([
      `collect(node)[${(page - 1) * count}..${page * count}] as items`,
      'total',
      `${(page - 1) * count + count} < total as hasMore`,
    ])
    .return(['items', 'total', 'hasMore']);

  // for troubleshooting
  // printQueryInConsole(query);

  return query.asResult<{ items: T[]; total: number; hasMore: boolean }>();
}

export async function runListQuery<T>(
  query: Query,
  input: SortablePaginationInput
) {
  const result = await listReturnBlock<T>(query, input).first();

  // result could be undefined if there are no matched nodes
  // in that case the total truly is 0 we just can't express that in cypher
  return (
    result ?? {
      items: [],
      total: 0,
      hasMore: false,
    }
  );
}

export const hasMore = (input: PaginationInput, total: number) =>
  // if skip + count is less than total, there is more
  (input.page - 1) * input.count + input.count < total;

export function matchUserPermissions(query: Query, label: string, id?: string) {
  query.match([
    node('requestingUser'),
    relation('in', '', 'member', {}, [1]),
    node('', 'SecurityGroup', { active: true }),
    relation('out', '', 'permission'),
    node('perms', 'Permission', { active: true }),
    relation('out', '', 'baseNode'),
    node('node', label, { active: true }),
  ]);
  if (id) {
    query.where({ node: { id } });
  }

  query.with(`collect(perms) as permList, node`);
}

// READ/LIST Property-ALL   functions that take a prop array
export function addAllPropertyOptionalMatches(
  query: Query,
  ...properties: string[]
) {
  for (const property of properties) {
    getProperty(query, property);
  }
}

// READ/LIST Property-SINGLE   functions that add queries for one property
export function getProperty(query: Query, property: string) {
  const readPerm = property + 'ReadPerm';
  const editPerm = property + 'EditPerm';
  query
    .optionalMatch([
      node(readPerm, 'Permission', {
        property,
        read: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('node'),
      relation('out', '', property, { active: true }),
      node(property, 'Property', { active: true }),
    ])
    .where({ [readPerm]: inArray(['permList'], true) })
    .optionalMatch([
      node(editPerm, 'Permission', {
        property,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('node'),
    ])
    .where({ [editPerm]: inArray(['permList'], true) });
}

// LIST Filtering
export function filterByString(
  query: Query,
  label: string,
  filterKey: string,
  filterValue: string
) {
  query.match([
    node('readPerm', 'Permission', {
      property: filterKey,
      read: true,
      active: true,
    }),
    relation('out', '', 'baseNode'),
    node('node', label, {
      active: true,
    }),
    relation('out', '', filterKey, { active: true }),
    node(filterKey, 'Property', { active: true }),
  ]);
  query.where({
    readPerm: inArray(['permList'], true),
    [filterKey]: { value: regexp(`.*${filterValue}.*`, true) },
  });
}

// used to search a specific user's relationship to the target base node
// for example, searching all orgs a user is a part of
export function filterByUser(
  query: Query,
  userId: string,
  relationshipType: string,
  relationshipDirection: RelationDirection,
  label: string
) {
  query.match([
    node('user', 'User', { active: true, id: userId }),
    relation(relationshipDirection, '', relationshipType, { active: true }),
    node('node', label, { active: true }),
  ]);
}

export interface Property {
  key: string;
  value: any;
  addToAdminSg: boolean;
  addToWriterSg: boolean;
  addToReaderSg: boolean;
  isPublic: boolean;
  isOrgPublic: boolean;
  label?: string;
}

// assumes 'requestingUser', 'root' and 'publicSG' cypher identifiers have been matched
export function createBaseNode(query: Query, label: string, props: Property[]) {
  const createdAt = DateTime.local().toString();

  query.create([
    node('node', [label, 'BaseNode'], {
      active: true,
      createdAt,
      id: generate(),
    }),
  ]);

  createSG(query, 'adminSG');
  createSG(query, 'writerSG');
  createSG(query, 'readerSG');
  addUserToSG(query, 'requestingUser', 'adminSG');
  addUserToSG(query, 'requestingUser', 'writerSG');
  addUserToSG(query, 'requestingUser', 'readerSG');

  for (const prop of props) {
    const labels = ['Property'];
    if (prop.label) {
      labels.push(prop.label);
    }
    query.create([
      node('node'),
      relation('out', '', prop.key, { active: true, createdAt }),
      node('', labels, { active: true, createdAt, value: prop.value }),
    ]);

    if (prop.addToAdminSg) {
      query.create([
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          active: true,
          createdAt,
          property: prop.key,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
      ]);
    }

    if (prop.addToWriterSg) {
      query.create([
        node('writerSG'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          active: true,
          createdAt,
          property: prop.key,
          read: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
      ]);
    }

    if (prop.addToReaderSg) {
      query.create([
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          active: true,
          createdAt,
          property: prop.key,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
      ]);
    }

    if (prop.isPublic) {
      query.create([
        node('publicSG'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          active: true,
          createdAt,
          property: prop.key,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
      ]);
    }

    // assumes 'orgSG' cypher variable is declared in a previous query
    if (prop.isOrgPublic) {
      query.create([
        node('orgSG'),
        relation('out', '', 'permission', {
          active: true,
        }),
        node('', 'Permission', {
          active: true,
          createdAt,
          property: prop.key,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('node'),
      ]);
    }
  }
}

// assumes 'root' cypher variable is declared in query
export function createSG(
  query: Query,
  cypherIdentifier: string,
  label?: string
) {
  const labels = ['SecurityGroup'];
  if (label) {
    labels.push(label);
  }
  const createdAt = DateTime.local().toString();

  query.create([
    node('root'),
    relation('in', '', 'member', { active: true }),
    node(cypherIdentifier, labels, { active: true, createdAt, id: generate() }),
  ]);
}

export function addUserToSG(
  query: Query,
  userCypherIdentifier: string,
  sGcypherIdentifier: string
) {
  const createdAt = DateTime.local().toString();

  query.create([
    node(userCypherIdentifier),
    relation('in', '', 'member', { active: true, createdAt }),
    node(sGcypherIdentifier),
  ]);
}
