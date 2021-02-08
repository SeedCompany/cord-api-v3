import { node, Query, relation } from 'cypher-query-builder';
import { Session } from '../../../common';
import { collect } from './cypher-functions';
import { mapping } from './mapping';

export const requestingUser = (session: Session) =>
  node('requestingUser', 'User', {
    id: session.userId,
  });

export const permissionsOfNode = (nodeLabel?: string) => [
  relation('in', 'memberOfSecurityGroup', 'member'),
  node('security', 'SecurityGroup'),
  relation('out', 'sgPerms', 'permission'),
  node('perms', 'Permission'),
  relation('out', 'permsOfBaseNode', 'baseNode'),
  node('node', nodeLabel),
];

export const matchPropList = (query: Query, nodeName = 'node') =>
  query
    .match([
      node(nodeName),
      relation('out', 'r', { active: true }),
      node('props', 'Property'),
    ])
    .with([
      collect(
        mapping({
          value: 'props.value',
          property: 'type(r)',
        }),
        'propList'
      ),
      nodeName,
    ]);
