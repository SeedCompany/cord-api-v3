import { node, Query, relation } from 'cypher-query-builder';
import { Term } from 'cypher-query-builder/dist/typings/clauses/term-list-clause';
import { Session } from '../../../common';
import { collect } from './cypher-functions';
import { mapping } from './mapping';

export const requestingUser = (session: Session) =>
  node('requestingUser', 'User', {
    id: session.userId,
  });

export const requestingRoles = (query: Query) =>
  query
    .optionalMatch([
      node('requestingUser'),
      relation('out', '', 'roles', { active: true }),
      node('requestingRoles', 'Property'),
    ])
    .with(['requestingUser', 'collect(requestingRoles) as requestingRoles']);

export const permissionsOfNode = (nodeLabel?: string) => [
  relation('in', 'memberOfSecurityGroup', 'member'),
  node('security', 'SecurityGroup'),
  relation('out', 'sgPerms', 'permission'),
  node('perms', 'Permission'),
  relation('out', 'permsOfBaseNode', 'baseNode'),
  node('node', nodeLabel),
];

export const matchPermList = (
  query: Query,
  user = 'requestingUser',
  ...withOther: Term[]
) =>
  query
    .optionalMatch([node(user), ...permissionsOfNode()])
    .with(['collect(distinct perms) as permList', 'node', ...withOther]);

export const matchPropList = (query: Query, ...withOther: Term[]) =>
  query
    .match([
      node('node'),
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
      'node',
      ...withOther,
    ]);
