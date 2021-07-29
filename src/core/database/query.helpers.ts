import { node, Query, relation } from 'cypher-query-builder';
import { Session } from '../../common';

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
