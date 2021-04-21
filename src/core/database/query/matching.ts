import { stripIndent } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { Session } from '../../../common';
import { collect } from './cypher-functions';
import { mapping } from './mapping';

export const requestingUser = (session: Session) =>
  node('requestingUser', 'User', {
    id: session.userId,
  });

/**
 * @deprecated DB SecurityGroups are deprecated
 */
export const permissionsOfNode = (nodeLabel?: string) => [
  relation('in', 'memberOfSecurityGroup', 'member'),
  node('security', 'SecurityGroup'),
  relation('out', 'sgPerms', 'permission'),
  node('perms', 'Permission'),
  relation('out', 'permsOfBaseNode', 'baseNode'),
  node('node', nodeLabel),
];

/**
 * @deprecated use matchProps instead. It returns props as an object instead of the weird list.
 */
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

/**
 * Matches all the given `node`s properties and returns them plus the props on
 * the base node as an object at the `props` key
 *
 * This is executed in a sub-query so other variables in scope are passed-through
 * transparently.
 */
export const matchProps = ({ nodeName = 'node' } = {}) => (query: Query) =>
  query.subQuery((sub) =>
    sub
      .with(nodeName)
      .match([
        node(nodeName),
        relation('out', 'r', { active: true }),
        node('prop', 'Property'),
      ])
      .return([
        stripIndent`
          apoc.map.mergeList(
            [node] + collect(
              apoc.map.fromValues([type(r), prop.value])
            )
          ) as props`,
      ])
  );
