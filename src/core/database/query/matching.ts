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

// Have to match project before using this
export const matchMemberRoles = (query: Query, userId: string) =>
  query
    .with(['project', 'node', 'propList'])
    .optionalMatch([
      [node('user', 'User', { id: userId })],
      [node('projectMember'), relation('out', '', 'user'), node('user')],
      [node('projectMember'), relation('in', '', 'member'), node('project')],
      [
        node('projectMember'),
        relation('out', '', 'roles', { active: true }),
        node('props', 'Property'),
      ],
    ])
    .with([collect('props.value', 'memberRoles'), 'propList', 'node']);
