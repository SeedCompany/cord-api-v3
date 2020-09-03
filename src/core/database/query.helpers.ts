import {
  contains,
  equals,
  greaterThan,
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
import { ISession, mapFromList, SortablePaginationInput } from '../../common';
import { ILogger } from '../logger';
import {
  coalesce,
  collect,
  count,
  mapping,
  matchPermList,
  matchPropList,
} from './query';
import { hasMore as newHasMore } from './results';

/** @deprecated */
const oldMapping = mapping;
/** @deprecated */
const oldCollect = collect;
/** @deprecated */
const oldCount = count;
/** @deprecated */
const oldCoalesce = coalesce;
export {
  oldMapping as mapping,
  oldCollect as collect,
  oldCount as count,
  oldCoalesce as coalesce,
};

// UTILITY //////////////////////////////////////////////////////

export function printActualQuery(logger: ILogger, query: Query) {
  const printMe = query;
  logger.debug(printMe.interpolate());
}

// eslint-disable-next-line @seedcompany/no-unused-vars
function printQueryInConsole(query: Query) {
  const printMe = query;
  // eslint-disable-next-line no-console
  console.log(printMe.interpolate());
}

// CREATE clauses //////////////////////////////////////////////////////

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
// add baseNodeProps and editableProps
export function createBaseNode(
  query: Query,
  label: string | string[],
  props: Property[],
  baseNodeProps?: { owningOrgId?: string | undefined; type?: string },
  editableProps?: string[],
  isRootuser?: boolean
) {
  const createdAt = DateTime.local();

  if (typeof label === 'string') {
    query.create([
      node('node', [label, 'BaseNode'], {
        active: true,
        createdAt,
        id: generate(),
        ...baseNodeProps,
      }),
    ]);
  } else {
    query.create([
      node('node', [...label, 'BaseNode'], {
        active: true,
        createdAt,
        id: generate(),
        ...baseNodeProps,
      }),
    ]);
  }

  createSG(query, 'adminSG');
  createSG(query, 'writerSG');
  createSG(query, 'readerSG');
  if (!isRootuser) {
    addUserToSG(query, 'requestingUser', 'adminSG');
    addUserToSG(query, 'requestingUser', 'writerSG');
    addUserToSG(query, 'requestingUser', 'readerSG');
  }

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
          edit: editableProps?.includes(prop.key) ? true : false,
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
  const createdAt = DateTime.local();

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
  const createdAt = DateTime.local();

  query.create([
    node(userCypherIdentifier),
    relation('in', '', 'member', { active: true, createdAt }),
    node(sGcypherIdentifier),
  ]);
}

// MATCHING LOOPS - not single matches //////////////////////////////////////////////////////

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

// MATCHING - for single properties //////////////////////////////////////////////////////
// READ/LIST Property-ALL   functions that take a prop array
export function addAllSecureProperties(query: Query, ...properties: string[]) {
  for (const property of properties) {
    getSecureProperty(query, property);
  }
}
// MATCHING - for single properties //////////////////////////////////////////////////////
// READ/LIST Property-ALL   functions that take a prop array
export function addAllSecurePropertiesSimple(
  query: Query,
  ...properties: string[]
) {
  for (const property of properties) {
    getSecurePropertySimple(query, property);
  }
}
// MATCHING - for single properties //////////////////////////////////////////////////////
// READ/LIST Property-ALL   functions that take a prop array
export function addAllSecurePropertiesSimpleRead(
  query: Query,
  ...properties: string[]
) {
  for (const property of properties) {
    getSecurePropertySimple(query, property, 'read');
  }
}
// MATCHING - for single properties //////////////////////////////////////////////////////
// READ/LIST Property-ALL   functions that take a prop array
export function addAllSecurePropertiesSimpleEdit(
  query: Query,
  ...properties: string[]
) {
  for (const property of properties) {
    getSecurePropertySimple(query, property, 'edit');
  }
}

export function addAllSecurePropertiesOfChildBaseNodes(
  query: Query,
  ...properties: ChildBaseNodeProperty[]
) {
  for (const property of properties) {
    getSecurePropertyOfChildBaseNode(query, property);
  }
}

export function addAllMetaPropertiesOfChildBaseNodes(
  query: Query,
  ...properties: ChildBaseNodeMetaProperty[]
) {
  for (const property of properties) {
    getMetaPropertyOfChildBaseNode(query, property);
  }
}

// READ/LIST Secure-Property-SINGLE   functions that add queries for one property
export function getSecureProperty(query: Query, property: string) {
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

// READ/LIST Secure-Property-SINGLE   functions that add queries for one property
export function getSecurePropertySimple(
  query: Query,
  property: string,
  type?: string
) {
  const readPerm = property + 'ReadPerm';
  const editPerm = property + 'EditPerm';

  if (!type || type === 'read') {
    query
      .optionalMatch([
        node(property, 'Property', { active: true }),
        relation('in', '', property, { active: true }),
        node('node'),
        relation('in', '', 'baseNode'),
        node(readPerm, 'Permission', {
          property,
          read: true,
          active: true,
        }),
      ])
      .where({ [readPerm]: inArray(['permList'], true) });
  }
  if (!type || type === 'edit') {
    query
      .optionalMatch([
        node(property, 'Property', { active: true }),
        relation('in', '', property, { active: true }),
        node('node'),
        relation('in', '', 'baseNode'),
        node(editPerm, 'Permission', {
          property,
          edit: true,
          active: true,
        }),
      ])
      .where({ [editPerm]: inArray(['permList'], true) });
  }
}

export interface ChildBaseNodeProperty {
  parentBaseNodePropertyKey: string;
  childBaseNodeLabel: string;
  childBaseNodePropertyKey: string;
}

export function getSecurePropertyOfChildBaseNode(
  query: Query,
  childBaseNodeProperty: ChildBaseNodeProperty
) {
  const parentReadPerm =
    childBaseNodeProperty.parentBaseNodePropertyKey + 'ReadPerm';
  const parentEditPerm =
    childBaseNodeProperty.parentBaseNodePropertyKey + 'EditPerm';
  const childReadPerm =
    childBaseNodeProperty.childBaseNodePropertyKey + 'ReadPerm';
  const childEditPerm =
    childBaseNodeProperty.childBaseNodePropertyKey + 'EditPerm';

  /*
    To get a child base node's property, we need a bunch of stuff.
    this query is similar to the normal 'getSecureProperty` query
    except that it adds the extra hops to a child base node and
    then to a property. we have to keep track of permissions for
    each hop, and we have to label the nodes using a convention
    so that the values can be extracted in the result query.
    */

  query
    .optionalMatch([
      [
        node(parentReadPerm, 'Permission', {
          property: childBaseNodeProperty.parentBaseNodePropertyKey,
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
        relation('out', '', childBaseNodeProperty.parentBaseNodePropertyKey, {
          active: true,
        }),
        node(
          childBaseNodeProperty.parentBaseNodePropertyKey,
          [childBaseNodeProperty.childBaseNodeLabel, 'BaseNode'],
          {
            active: true,
          }
        ),
        relation('out', '', childBaseNodeProperty.childBaseNodePropertyKey, {
          active: true,
        }),
        node(
          childBaseNodeProperty.parentBaseNodePropertyKey +
            childBaseNodeProperty.childBaseNodePropertyKey,
          'Property',
          { active: true }
        ),
      ],
      [
        node(childReadPerm, 'Permission', {
          property: childBaseNodeProperty.childBaseNodePropertyKey,
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node(childBaseNodeProperty.parentBaseNodePropertyKey),
      ],
    ])
    .where({
      [parentReadPerm]: inArray(['permList'], true),
      [childReadPerm]: inArray(['permList'], true),
    })
    .optionalMatch([
      node(parentEditPerm, 'Permission', {
        property: childBaseNodeProperty.parentBaseNodePropertyKey,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('node'),
    ])
    .where({ [parentEditPerm]: inArray(['permList'], true) })
    .optionalMatch([
      node(childEditPerm, 'Permission', {
        property: childBaseNodeProperty.childBaseNodePropertyKey,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node(childBaseNodeProperty.parentBaseNodePropertyKey),
    ])
    .where({ [childEditPerm]: inArray(['permList'], true) });
}

export interface ChildBaseNodeMetaProperty {
  parentBaseNodePropertyKey: string;
  parentRelationDirection: RelationDirection;
  childBaseNodeLabel: string;
  childBaseNodeMetaPropertyKey: string;
  returnIdentifier: string;
}

// todo: i have removed security from the ids of child nodes
// we might need to think through whether to give public access to
// the id fields of base nodes.
export function getMetaPropertyOfChildBaseNode(
  query: Query,
  childBaseNodeProperty: ChildBaseNodeMetaProperty
) {
  const parentReadPerm =
    childBaseNodeProperty.parentBaseNodePropertyKey + 'ReadPerm';
  const parentEditPerm =
    childBaseNodeProperty.parentBaseNodePropertyKey + 'EditPerm';

  /*
    To get a child base node's property, we need a bunch of stuff.
    this query is similar to the normal 'getSecureProperty` query
    except that it adds the extra hops to a child base node and
    then to a property. we have to keep track of permissions for
    each hop, and we have to label the nodes using a convention
    so that the values can be extracted in the result query.
    */

  query
    .optionalMatch([
      node('node'),
      relation(
        childBaseNodeProperty.parentRelationDirection,
        '',
        childBaseNodeProperty.parentBaseNodePropertyKey,
        {
          active: true,
        }
      ),
      node(
        childBaseNodeProperty.parentBaseNodePropertyKey,
        [childBaseNodeProperty.childBaseNodeLabel, 'BaseNode'],
        {
          active: true,
        }
      ),
    ])
    .optionalMatch([
      node(parentReadPerm, 'Permission', {
        property: childBaseNodeProperty.parentBaseNodePropertyKey,
        read: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('node'),
    ])
    .where({
      [parentReadPerm]: inArray(['permList'], true),
    })
    .optionalMatch([
      node(parentEditPerm, 'Permission', {
        property: childBaseNodeProperty.parentBaseNodePropertyKey,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node('node'),
    ])
    .where({
      [parentEditPerm]: inArray(['permList'], true),
    });
}

export function matchUserPermissions(
  query: Query,
  label?: string,
  id?: string
) {
  query.match([
    node('requestingUser'),
    relation('in', '', 'member', {}, [1]),
    node('', 'SecurityGroup', { active: true }),
    relation('out', '', 'permission'),
    node('perms', 'Permission', { active: true }),
    relation('out', '', 'baseNode'),
    label
      ? node('node', label, { active: true })
      : node('node', { active: true }),
  ]);
  if (id) {
    query.where({ node: { id } });
  }

  query.with(`collect(perms) as permList, node, requestingUser`);
}

export function matchUserPermissionsIn(
  query: Query,
  label?: string,
  ids?: string[]
) {
  query.match([
    node('requestingUser'),
    relation('in', '', 'member', {}, [1]),
    node('', 'SecurityGroup', { active: true }),
    relation('out', '', 'permission'),
    node('perms', 'Permission', { active: true }),
    relation('out', '', 'baseNode'),
    label
      ? node('node', label, { active: true })
      : node('node', { active: true }),
  ]);
  if (ids) {
    query.where({ node: { id: inArray(ids) }, perms: { read: true } });
  }

  query.with(`collect(perms) as permList, node`);
}

export function matchUserPermissionsForList(
  query: Query,
  label: string,
  page: number,
  count: number,
  id?: string
) {
  query
    .match([
      node('requestingUser'),
      relation('in', '', 'member', {}, [1]),
      node('sg', 'SecurityGroup', { active: true }),
    ])
    .with('collect(distinct sg) as sgList')
    .match([
      node('sg'),
      relation('out', '', 'permission'),
      node('perm', 'Permission', { active: true }),
      relation('out', '', 'baseNode'),
      node('node', label, { active: true }),
    ]);
  if (id) {
    query.where({
      node: { id },
      sg: inArray(['sgList', true]),
    });
  } else {
    query.where({ sg: inArray(['sgList'], true) });
  }

  // query
  //   .with(
  //     `collect(distinct perm) as permList, node, count(distinct node) as total`
  //   )
  //   .with(
  //     `permList, node, total, ${(page - 1) * count + count} < total as hasMore`
  //   );
}

export function matchRequestingUser(query: Query, session: ISession) {
  query.match([
    node('requestingUser', 'User', {
      active: true,
      id: session.userId,
    }),
  ]);
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

// FILTERING MATCHES //////////////////////////////////////////////////////

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

export function filterByArray(
  query: Query,
  label: string,
  filterKey: string,
  filterValue: string[]
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
    [filterKey]: { value: equals(filterValue) },
  });
}

export function filterBySubarray(
  query: Query,
  label: string,
  filterKey: string,
  filterValue: string[]
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
    [filterKey]: { value: inArray(filterValue) },
  });
  query.with(`permList, node`);
}

// LIST Filtering
export function filterByChildBaseNodeCount(
  query: Query,
  label: string,
  filterKey: string
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
    node(filterKey, 'BaseNode', { active: true }),
  ]);
  query
    .with(
      `
      readPerm,
      permList,
      node,
      ${count(filterKey, { distinct: true, as: `${filterKey}_count` })}
    `
    )
    .where({
      readPerm: inArray(['permList'], true),
      [`${filterKey}_count`]: greaterThan(1),
    });
}

// used to search a specific user's relationship to the target base node
// for example, searching all orgs a user is a part of
export function filterByBaseNodeId(
  query: Query,
  filterNodeId: string,
  relationshipType: string,
  relationshipDirection: RelationDirection,
  filterBaseNodelabel: string,
  originBaseNodeLabel: string
) {
  query.match([
    node('node', originBaseNodeLabel, { active: true }),
    relation(relationshipDirection, '', relationshipType, { active: true }),
    node('bn', filterBaseNodelabel, { active: true, id: filterNodeId }),
  ]);
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

// WITH CLAUSES or SHAPING helpers //////////////////////////////////////////////////////

export function addPropertyCoalesceWithClause(property: string) {
  return mapping(property, securedProperty(property));
}

export function addShapeForChildBaseNodeMetaProperty(
  property: ChildBaseNodeMetaProperty
) {
  return `
    coalesce(${property.parentBaseNodePropertyKey}.${property.childBaseNodeMetaPropertyKey})
    as ${property.returnIdentifier}
  `;
}

export function addShapeForBaseNodeMetaProperty(property: string) {
  return `coalesce(node.${property}) as ${property}`;
}

export const securedProperty = (property: string) => ({
  value: coalesce(`${property}.value`),
  canRead: coalesce(`${property}ReadPerm.read`, false),
  canEdit: coalesce(`${property}EditPerm.edit`, false),
});

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

export function listWithSecureObjectAsObject(props: string[]) {
  return mapFromList(props, (prop) => [prop, mapping(securedProperty(prop))]);
}

export function addBaseNodeMetaPropsWithClause(props: string[]) {
  return props.map((x) => `${x}: node.${x}`).join(', ');
}

export function addBaseNodeMetaPropsWithClauseAsObject(props: string[]) {
  return mapFromList(props, (prop) => [prop, `node.${prop}`]);
}

// RETURN clauses //////////////////////////////////////////////////////

/** @deprecated */
export const hasMore = newHasMore;

/** @deprecated */
export function listReturnBlock<T = any>(
  query: Query,
  { page, count, sort: sortInput, order }: SortablePaginationInput,
  isSecuredSort: boolean,
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
        : isSecuredSort
        ? `node.${sortInput}.value`
        : `node.${sortInput}`,
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

// RUN functions //////////////////////////////////////////////////////

/** @deprecated */
export async function runListQuery<T>(
  query: Query,
  input: SortablePaginationInput,
  isSecuredSort = true
) {
  const result = await listReturnBlock<T>(query, input, isSecuredSort).first();

  // troubleshooting
  // console.log(JSON.stringify(result));

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

/** @deprecated */
export const getPermList = matchPermList;

/** @deprecated */
export const getPropList = matchPropList;
