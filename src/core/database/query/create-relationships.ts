import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { Maybe as Nullable } from 'graphql/jsutils/Maybe';
import { DateTime } from 'luxon';
import { ID, many, ResourceShape } from '../../../common';
import { ResourceMap } from '../../../components/authorization/model/resource-map';

type RelationshipDefinition = Record<
  string,
  [
    baseNodeLabel: keyof ResourceMap | 'BaseNode',
    id: Nullable<ID> | readonly ID[]
  ]
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
 */
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  direction: RelationDirection,
  labelsToRelationships: RelationshipDefinition
): (query: Query) => Query;
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  definition: AnyDirectionalDefinition
): (query: Query) => Query;
export function createRelationships<TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  directionOrDefinition: RelationDirection | AnyDirectionalDefinition,
  maybeLabelsToRelationships?: RelationshipDefinition
) {
  const normalizedArgs =
    typeof directionOrDefinition === 'string'
      ? { [directionOrDefinition]: maybeLabelsToRelationships }
      : directionOrDefinition;

  const flattened = Object.entries(normalizedArgs).flatMap(
    ([direction, relationships]) =>
      Object.entries(relationships ?? {}).flatMap(
        ([relLabel, [nodeLabel, ids]]) =>
          many(ids ?? []).map((id, i) => ({
            nodeLabel,
            id,
            direction: direction as RelationDirection,
            relLabel: relLabel,
            variable: Array.isArray(ids) ? `${relLabel}${i}` : relLabel,
          }))
      )
  );

  if (flattened.length === 0) {
    // Do nothing in query if there are no IDs to connect
    return (query: Query) => query;
  }

  // We are creating inside of changeset if there's a changeset relation into the node.
  const inChangeset = flattened.some(
    (f) => f.direction === 'in' && f.relLabel === 'changeset' && f.id
  );

  const createdAt = DateTime.local();
  return (query: Query) =>
    query.comment`
      createRelationships(${resource.name})
    `.subQuery('node', (sub) =>
      sub
        .match(
          flattened.map(({ variable, nodeLabel, id }) => [
            node(variable, nodeLabel, { id }),
          ])
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
          ])
        )
        .return(flattened.map((f) => f.variable))
    );
}
