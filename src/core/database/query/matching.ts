import {
  node,
  type NodePattern,
  type Query,
  relation,
} from 'cypher-query-builder';
import { uniq } from 'lodash';
import { DateTime } from 'luxon';
import { type Tagged } from 'type-fest';
import { labelForView, many, type Many, type ObjectView } from '~/common';
import { variable } from '../query-augmentation/condition-variables';
import { apoc, collect, exists, listConcat, merge } from './cypher-functions';

const currentUserFlag = Symbol();
const makeCurrentUser = (name: string) =>
  Object.assign(
    Object.defineProperty(
      node(name, 'User', { id: variable('$currentUser') }),
      currentUserFlag,
      {},
    ) as Tagged<NodePattern, 'CurrentUser'>,
    {
      as: makeCurrentUser,
      is: (obj: object): obj is typeof currentUser =>
        Object.hasOwn(obj, currentUserFlag),
    },
  );
export const currentUser = makeCurrentUser('');

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
      )
        .with([
          nodeName,
          `${optional ? 'props' : collectProps} as collectedProps`,
        ])
        .with(
          listConcat(
            `[${excludeBaseProps ? '' : nodeName}]`,
            'collectedProps',
          ).as('propList'),
        )
        .return(merge('propList').as(outputVar)),
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

export const pinned = exists([
  currentUser,
  relation('out', '', 'pinned'),
  node('node'),
]);
