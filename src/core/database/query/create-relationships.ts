import { entries } from '@seedcompany/common';
import { createHash } from 'crypto';
import { node, type Query, relation } from 'cypher-query-builder';
import { type RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { type Maybe as Nullable } from 'graphql/jsutils/Maybe';
import { DateTime } from 'luxon';
import { EnhancedResource, type ID, many, type ResourceShape } from '~/common';
import { type ResourceMap } from '~/core';
import { Variable } from '../query-augmentation/condition-variables';
import { currentUser } from './matching';

type RelationshipDefinition = Record<
  string,
  | [
      baseNodeLabel: keyof ResourceMap | 'BaseNode',
      id: Nullable<ID> | readonly ID[],
    ]
  | Variable
  | typeof currentUser
>;
type AnyDirectionalDefinition = Partial<
  Record<RelationDirection, RelationshipDefinition>
>;

/**
 * Creates relationships to/from `node` to/from other base nodes.
 *
 * If the ID value is nil then the match & create is skipped.
 *
 * @example
 * createRelationships(Location, 'out', {
 *   fundingAccount: [          // label of the relationship to create
 *     'FundingAccount',        // base node label to match
 *     input.fundingAccountId,  // id of the base node to match
 *   ],
 *   createdBy: ['User', input.creatorId], // simple one liner
 * })
 * // This above yields the below cypher
 * MATCH (fundingAccount:FundingAccount { id: $fundingAccountId }),
 *       (createdBy:User { id: $creatorId })
 * CREATE (node)-[:fundingAccount]->(fundingAccount),
 *        (node)-[:createdBy]->(createdBy)
 *
 * @example
 * // Multiple directions can be given this way
 * createRelationships(Location, {
 *   in: {
 *     owningOrganization: ['Organization', orgId],
 *   },
 *   out: {
 *     createdBy: ['User', input.creatorId],
 *   },
 * })
 *
 * IDs can also be given as variables, referencing BaseNodes already defined
 * in the query. In this case, this will import it into the sub-query instead of
 * matching it, and it will also not return it so it doesn't conflict.
 * @example
 * .match([
 *   [node('node', 'Location', { id })],
 *   [node('user', 'User')], // `user` defined in query - in any way.
 * ])
 * .apply(createRelationships(Location, 'out', {
 *   createdBy: variable('user'),
 *   fundingAccount: ['FundingAccount', input.fundingAccountId]
 * }))
 * // This above yields the below cypher
 * MATCH (node:Location { id: $id }),
 *       (user:User)
 * CALL {
 *   WITH node, user
 *   MATCH (fundingAccount:FundingAccount { id: $fundingAccountId })
 *   CREATE (node)-[:fundingAccount]->(fundingAccount),
 *          (node)-[:createdBy]->(user)
 *   RETURN fundingAccount
 * }
 * // Note how `user` is imported, not matched, and not returned.
 */
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  direction: RelationDirection,
  labelsToRelationships: RelationshipDefinition,
): (query: Query) => Query;
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  definition: AnyDirectionalDefinition,
): (query: Query) => Query;
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  directionOrDefinition: RelationDirection | AnyDirectionalDefinition,
  maybeLabelsToRelationships?: RelationshipDefinition,
) {
  resource = EnhancedResource.of(resource);
  const normalizedArgs: AnyDirectionalDefinition =
    typeof directionOrDefinition === 'string'
      ? { [directionOrDefinition]: maybeLabelsToRelationships }
      : directionOrDefinition;

  const flattened = entries(normalizedArgs).flatMap(
    ([direction, relationships]) =>
      Object.entries(relationships).flatMap(([relLabel, varOrTuple]) =>
        many(Array.isArray(varOrTuple) ? varOrTuple[1] ?? [] : varOrTuple).map(
          (id, i) => ({
            nodeLabel: Array.isArray(varOrTuple) ? varOrTuple[0] : undefined, // no labels for variables
            id,
            direction,
            relLabel,
            variable: !Array.isArray(varOrTuple)
              ? varOrTuple instanceof Variable
                ? varOrTuple.value
                : currentUser.is(varOrTuple)
                ? relLabel
                : undefined
              : Array.isArray(varOrTuple[1])
              ? `${relLabel}${i}`
              : relLabel,
          }),
        ),
      ),
  );

  if (flattened.length === 0) {
    // Do nothing in query if there are no IDs to connect
    return (query: Query) => query;
  }

  // We're creating inside a changeset if there is a changeset relation into the node.
  const inChangeset = flattened.some(
    (f) => f.direction === 'in' && f.relLabel === 'changeset',
  );

  const createdAt = DateTime.local();

  const returnTerms = flattened.flatMap((f) =>
    f.id instanceof Variable ? [] : f.variable ?? [],
  );
  if (returnTerms.length === 0) {
    // Create hash based on input to use as a unique return since a return
    // statement is required for sub-queries but not needed here.
    const hash = createHash('sha1')
      .update(resource.name + JSON.stringify(normalizedArgs))
      .digest('base64');
    returnTerms.push(`"unknown" as \`${hash}\``);
  }

  return (query: Query) => {
    return query.comment`
      createRelationships(${resource.name})
    `.subQuery(
      [
        'node',
        ...flattened.flatMap(({ id }) =>
          id instanceof Variable ? id.value : [],
        ),
      ],
      (sub) =>
        sub
          .match(
            flattened.map(({ variable, nodeLabel, id }) =>
              id instanceof Variable
                ? []
                : currentUser.is(id)
                ? [id.as(variable!)]
                : [node(variable, nodeLabel, { id })],
            ),
          )
          .create(
            flattened.map(({ direction, relLabel, variable }) => [
              node('node'),
              relation(direction, '', relLabel, {
                // When creating inside of changeset, all relationships into the
                // node (besides changeset relation) are marked as inactive until
                // changeset is applied
                active: !(
                  inChangeset &&
                  direction === 'in' &&
                  relLabel !== 'changeset'
                ),
                createdAt,
              }),
              node(variable),
            ]),
          )
          .return(returnTerms),
    );
  };
}
