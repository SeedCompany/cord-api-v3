import { node, Query, relation } from 'cypher-query-builder';
import { deburr } from 'lodash';
import { DateTime } from 'luxon';
import { Resource, Session } from '../../common';

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

//DELETE service
export const setBaseNodeLabelsAndIdDeleted = (
  query: Query,
  baseNodeLabels: string[]
) => {
  //set labels as Deleted
  baseNodeLabels.forEach((label) => {
    query.call(setLabelDeleted, 'node', label).with('distinct(node) as node');
  });

  //set id as deleted_id

  query
    .with('*, node.id as nodeId')
    .set({
      variables: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'node.deleted_id': 'nodeId',
      },
    })
    .removeProperties({
      node: 'id',
    })
    .with('distinct(node) as node');
};

export type UniqueProperties<BaseNode extends Resource> = Partial<
  Record<keyof BaseNode, string[]>
>;

export function setPropLabelsAndValuesDeleted(
  query: Query,
  uniqueProperties: string[]
) {
  uniqueProperties.forEach((property, i) => {
    query
      .match([
        node('node'),
        relation('out', '', { active: true }),
        node(`prop${i}`, property),
      ])
      .call(setLabelDeleted, `prop${i}`, property)
      .with('*')
      .raw(
        `
      set prop${i}.deleted_value = prop${i}.value
      set prop${i}.deleted_sortValue = prop${i}.sortValue
      remove prop${i}.value
      remove prop${i}.sortValue
      `
      )
      .with('*');
  });
}

const setLabelDeleted = (query: Query, nodeAlias: string, label: string) => {
  query
    .set({
      labels: {
        [nodeAlias]: `Deleted_${label}`,
      },
    })
    .removeLabels({
      [nodeAlias]: label,
    });
};
