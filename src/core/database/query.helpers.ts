import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { entries, ISession, Resource } from '../../common';

// CREATE clauses //////////////////////////////////////////////////////

export interface Property {
  key: string;
  value: any;
  isPublic: boolean;
  isOrgPublic: boolean;
  label?: string;
}

// assumes 'requestingUser', and 'publicSG' cypher identifiers have been matched
// add baseNodeProps and editableProps
export function createBaseNode(
  query: Query,
  id: string,
  label: string | string[],
  props: Property[],
  baseNodeProps?: { owningOrgId?: string | undefined; type?: string },
  _editableProps?: string[],
  _isRootuser?: boolean
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
    query.create([
      node('node'),
      relation('out', '', prop.key, { active: true, createdAt }),
      node('', labels, { createdAt, value: prop.value }),
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
    relation('in', '', 'member', {}, [1]),
    node('', 'SecurityGroup'),
    relation('out', '', 'permission'),
    node('perms', 'Permission'),
    relation('out', '', 'baseNode'),
    label ? node('node', label) : node('node'),
  ]);
  if (id) {
    query.where({ node: { id } });
  }

  query.with(`collect(perms) as permList, node, requestingUser`);
}

export function matchRequestingUser(
  query: Query,
  { userId }: Partial<ISession>
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
