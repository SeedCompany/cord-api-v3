import { stripIndent } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, Session } from '../../../common';
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
export const matchPropList = (query: Query, changeId?: ID, nodeName = 'node') =>
  query
    .match([
      node(nodeName),
      relation('out', 'r', { active: !changeId }),
      node('props', 'Property'),
      ...(changeId
        ? [
            relation('in', '', 'change', { active: true }),
            node('planChange', 'PlanChange', { id: changeId }),
          ]
        : []),
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

export interface MatchPropsOptions {
  // The node var to pull properties from
  nodeName?: string;
  // The variable name to output as
  outputVar?: string;
  // Whether we should move forward even without any properties matched
  optional?: boolean;
  // The optional change ID to reference
  changeId?: ID;
  // Don't merge in the actual BaseNode's properties into the resulting output object
  excludeBaseProps?: boolean;
}

/**
 * Matches all the given `node`s properties and returns them plus the props on
 * the base node as an object at the `props` key
 *
 * This is executed in a sub-query so other variables in scope are passed-through
 * transparently.
 */
export const matchProps =
  ({
    nodeName = 'node',
    outputVar = 'props',
    optional = false,
    changeId,
    excludeBaseProps = false,
  }: MatchPropsOptions = {}) =>
  (query: Query) =>
    query.subQuery((sub) =>
      sub
        .with(nodeName)
        .match(
          [
            node(nodeName),
            relation('out', 'r', { active: !changeId }),
            node('prop', 'Property'),
            ...(changeId
              ? [
                  relation('in', '', 'change', { active: true }),
                  node('planChange', 'PlanChange', { id: changeId }),
                ]
              : []),
          ],
          {
            optional,
          }
        )
        .return([
          stripIndent`
          apoc.map.mergeList(
            ${excludeBaseProps ? '' : `[${nodeName}] + `}collect(
              apoc.map.fromValues([type(r), prop.value])
            )
          ) as ${outputVar}`,
        ])
    );
