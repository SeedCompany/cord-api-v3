import { node, Query, relation } from 'cypher-query-builder';
import { deburr } from 'lodash';
import { DateTime } from 'luxon';
import { ResourceShape, Session } from '../../common';

// CREATE clauses //////////////////////////////////////////////////////

export interface Property {
  key: string;
  value: any;
  isPublic: boolean;
  isOrgPublic: boolean;
  label?: string;
  isDeburrable?: boolean;
}

export interface AllNodeProperties {
  createdAt: DateTime;
  value: any;
  sortValue: string;
}

export const determineSortValue = (value: unknown) =>
  typeof value === 'string' ? deburr(value) : value;

// assumes 'requestingUser', and 'publicSG' cypher identifiers have been matched
// add baseNodeProps and editableProps
export function createBaseNode(
  query: Query,
  id: string,
  label: string | string[],
  props: Property[],
  baseNodeProps?: { owningOrgId?: string | undefined; type?: string }
) {
  const createdAt = DateTime.local();

  if (typeof label === 'string') {
    query.create([
      node('node', [label, 'BaseNode'], {
        createdAt,
        id,
        ...baseNodeProps,
      }),
    ]);
  } else {
    query.create([
      node('node', [...label, 'BaseNode'], {
        createdAt,
        id,
        ...baseNodeProps,
      }),
    ]);
  }

  for (const prop of props) {
    const labels = ['Property'];
    if (prop.label) {
      labels.push(prop.label);
    }
    const nodeProps = {
      createdAt,
      value: prop.value,
      sortValue: determineSortValue(prop.value),
    };

    query.create([
      node('node'),
      relation('out', '', prop.key, { active: true, createdAt }),
      node('', labels, nodeProps),
    ]);
  }
}

export function matchUserPermissions(
  query: Query,
  label?: string,
  id?: string
) {
  query.match([
    node('requestingUser'),
    relation('in', 'memberOfSecurityGroup', 'member', {}, [1]),
    node('security', 'SecurityGroup'),
    relation('out', 'sgPerms', 'permission'),
    node('perms', 'Permission'),
    relation('out', 'permsOfBaseNode', 'baseNode'),
    label ? node('node', label) : node('node'),
  ]);
  if (id) {
    query.where({ node: { id } });
  }

  query.with(`collect(perms) as permList, node, requestingUser`);
}

export function matchRequestingUser(
  query: Query,
  { userId }: Pick<Session, 'userId'>
) {
  query.match([
    node('requestingUser', 'User', {
      id: userId,
    }),
  ]);
}

/**
 * This will set all relationships given to active false
 * and add deleted prefix to its labels.
 */
export const deleteProperties = <Resource extends ResourceShape<any>>(
  _resource: Resource,
  ...relationLabels: ReadonlyArray<keyof Resource['prototype']>
) => (query: Query) => {
  if (relationLabels.length === 0) {
    return query;
  }
  const relationStr = relationLabels.join('|');
  return query.raw(
    `
    match(node)-[propertyRel:${relationStr} {active: true}]->(property:Property)
    set propertyRel.active = false
    with property, reduce(deletedLabels = [], label in labels(property) | deletedLabels + ("Deleted_" + label)) as deletedLabels
    call apoc.create.removeLabels(property, labels(property)) yield node as nodeRemoved
    with property, deletedLabels
    call apoc.create.addLabels(property, deletedLabels) yield node as nodeAdded
    with *
  `
  );
};
