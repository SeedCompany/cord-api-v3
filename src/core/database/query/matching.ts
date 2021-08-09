import { node, Query, relation } from 'cypher-query-builder';
import { ID, Many, Session } from '../../../common';
import { apoc, collect, listConcat, merge } from './cypher-functions';

export const requestingUser = (session: Session) =>
  node('requestingUser', 'User', {
    id: session.userId,
  });

/**
 * @deprecated DB SecurityGroups are deprecated
 */
export const permissionsOfNode = (nodeLabel: Many<string>) => [
  relation('in', 'memberOfSecurityGroup', 'member'),
  node('security', 'SecurityGroup'),
  relation('out', 'sgPerms', 'permission'),
  node('perms', 'Permission'),
  relation('out', 'permsOfBaseNode', 'baseNode'),
  node('node', nodeLabel),
];

export interface MatchPropsOptions {
  // The node var to pull properties from
  nodeName?: string;
  // The variable name to output as
  outputVar?: string;
  // Whether we should move forward even without any properties matched
  optional?: boolean;
  // The optional change ID to reference
  changeset?: ID;
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
export const matchProps = (options: MatchPropsOptions = {}) => {
  const {
    nodeName = 'node',
    outputVar = 'props',
    optional = false,
    changeset,
    excludeBaseProps = false,
  } = options;
  return (query: Query) =>
    query.comment`matchProps(${nodeName})`.subQuery(nodeName, (sub) =>
      sub
        .match(
          [
            node(nodeName),
            relation('out', 'r', { active: !changeset }),
            node('prop', 'Property'),
            ...(changeset
              ? [
                  relation('in', '', 'changeset', { active: true }),
                  node('changeset', 'Changeset', { id: changeset }),
                ]
              : []),
          ],
          {
            optional,
          }
        )
        .return(
          merge(
            listConcat(
              `[${excludeBaseProps ? '' : nodeName}]`,
              collect(apoc.map.fromValues(['type(r)', 'prop.value']))
            )
          ).as(outputVar)
        )
    );
};
