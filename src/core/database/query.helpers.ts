import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Session } from '../../common';
// eslint-disable-next-line @seedcompany/no-unused-vars -- used in jsdoc
import { createNode } from './query';

// CREATE clauses //////////////////////////////////////////////////////

/**
 * @deprecated Use {@link createNode} instead
 */
export interface Property {
  key: string;
  value: any;
  isPublic: boolean;
  isOrgPublic: boolean;
  label?: string;
  isDeburrable?: boolean;
}

/**
 * @deprecated Use {@link createNode} instead
 */
export const createBaseNode =
  (
    id: ID,
    label: string | string[],
    props: Property[],
    baseNodeProps?: { owningOrgId?: string | undefined; type?: string }
  ) =>
  (query: Query) => {
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
      };

      query.create([
        node('node'),
        relation('out', '', prop.key, { active: true, createdAt }),
        node('', labels, nodeProps),
      ]);
    }
  };

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

export const matchRequestingUser =
  ({ userId }: Pick<Session, 'userId'>) =>
  (query: Query) =>
    query.match([
      node('requestingUser', 'User', {
        id: userId,
      }),
    ]);
