import { node, Query, relation } from 'cypher-query-builder';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import {
  ID,
  isIdLike,
  labelForView,
  many,
  Many,
  ObjectView,
  Session,
} from '../../../common';
import { variable } from '../query-augmentation/condition-variables';
import { apoc, collect, listConcat, merge } from './cypher-functions';

export const requestingUser = (session: Session | ID) => {
  const n = node('requestingUser', 'User', {
    id: variable('$requestingUser'),
  });
  n.addParam(isIdLike(session) ? session : session.userId, 'requestingUser');
  return n;
};

export const matchRequestingUser =
  ({ userId }: Pick<Session, 'userId'>) =>
  (query: Query) =>
    query.match(requestingUser(userId));

/**
 * Same as `{ active: true }` but it doesn't create a bound parameter
 */
export const ACTIVE = { active: variable('true') };

/**
 * Same as `{ active: false }` but it doesn't create a bound parameter
 */
export const INACTIVE = { active: variable('false') };

export interface MatchPropsOptions {
  // The node var to pull properties from
  nodeName?: string;
  // The variable name to output as
  outputVar?: string;
  // Whether we should move forward even without any properties matched
  optional?: boolean;
  // Don't merge in the actual BaseNode's properties into the resulting output object
  excludeBaseProps?: boolean;
  // View object
  view?: ObjectView;
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
    excludeBaseProps = false,
    view = { active: true },
  } = options;
  return (query: Query) => {
    const lookupProps = (query: Query) =>
      query.match([
        node(nodeName),
        relation('out', 'r', view.changeset ? INACTIVE : ACTIVE),
        node('prop', labelForView('Property', view)),
        ...(view.changeset
          ? [
              relation('in', '', 'changeset', ACTIVE),
              node('changeset', 'Changeset', { id: view.changeset }),
            ]
          : []),
      ]);
    const collectProps = collect(
      apoc.map.fromValues(['type(r)', 'prop.value']),
    );

    return query.comment`matchProps(${nodeName})`.subQuery(nodeName, (sub) =>
      // If optional match in another sub-query where the return clause's
      // outer most function is collect() so that a single row with props
      // as an empty list is returned when no properties are matched.
      // OPTIONAL MATCH should work instead of this, but it bugs out
      // with complex queries.
      // Error is "Tried overwriting already taken variable name" with v4.2.8
      (optional
        ? sub.subQuery(nodeName, (sub2) =>
            sub2.apply(lookupProps).return(collectProps.as('props')),
          )
        : sub.apply(lookupProps)
      ).return(
        merge(
          listConcat(
            `[${excludeBaseProps ? '' : nodeName}]`,
            optional ? 'props' : collectProps,
          ),
        ).as(outputVar),
      ),
    );
  };
};

export const property = (
  prop: string,
  value: any | null,
  baseNode: string,
  propVar = prop,
  extraPropLabel?: Many<string>,
) => [
  [
    node(baseNode),
    relation('out', '', prop, {
      active: true,
      createdAt: DateTime.local(),
    }),
    node(propVar, uniq(['Property', ...many(extraPropLabel ?? [])]), {
      value,
    }),
  ],
];

export const matchSession = (
  session: Session,
  {
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclEdit,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclRead,
    requestingUserConditions = {},
  }: {
    withAclEdit?: string;
    withAclRead?: string;
    requestingUserConditions?: Record<string, any>;
  } = {},
) => [
  node('token', 'Token', {
    active: true,
    value: session.token,
  }),
  relation('in', '', 'token', {
    active: true,
  }),
  node('requestingUser', 'User', {
    id: session.userId,
    ...requestingUserConditions,
  }),
];
