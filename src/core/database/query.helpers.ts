import { node, Query, relation } from 'cypher-query-builder';
import { deburr } from 'lodash';
import { DateTime } from 'luxon';
import { entries, Resource, Session } from '../../common';

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

// just like createBaseNode, but without the security Group creations.
// ... being used for performance refactor
export function createBaseNodeNew(
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

    if (prop.isPublic) {
      query.create([
        node('publicSG'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: prop.key,
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
      ]);
    }

    // assumes 'orgSG' cypher variable is declared in a previous query
    if (prop.isOrgPublic) {
      query.create([
        node('orgSG'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: prop.key,
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
      ]);
    }
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

export function setPropLabelsAndValuesDeleted<BaseNode extends Resource>(
  query: Query,
  uniqueProperties: UniqueProperties<BaseNode>
) {
  entries(uniqueProperties).forEach(([property, labels], i) => {
    const currentPropertyNodeAlias = `propertyNode${i}`;
    // Match the baseNode out to the propertyNode
    query.optionalMatch([
      node('node'),
      relation('out', '', property),
      node(currentPropertyNodeAlias, 'Property'),
    ]);

    // Reset all the labels on the propertyNode with the Delete_ prefix
    labels?.forEach((label) => {
      query.call(setLabelDeleted, currentPropertyNodeAlias, label);
    });

    // Reset all the values on the propertyNode to deleted_value
    query
      .with(`*, ${currentPropertyNodeAlias}.value as propVal${i}`)
      .set({
        variables: {
          [`${currentPropertyNodeAlias}.deleted_value`]: `propVal${i}`,
        },
      })
      .removeProperties({
        [currentPropertyNodeAlias]: 'value',
      })
      .with('*');
  });
}

const setLabelDeleted = (query: Query, nodeAlas: string, label: string) => {
  query
    .set({
      labels: {
        [nodeAlas]: `Deleted_${label}`,
      },
    })
    .removeLabels({
      [nodeAlas]: label,
    });
};
