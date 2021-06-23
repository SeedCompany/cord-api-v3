import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { Maybe as Nullable } from 'graphql/jsutils/Maybe';
import { DateTime } from 'luxon';
import { ID, many, ResourceShape } from '../../../common';
import { ResourceMap } from '../../../components/authorization/model/resource-map';

type RelationshipDefinition = Record<
  string,
  [baseNodeLabel: keyof ResourceMap, id: Nullable<ID> | readonly ID[]]
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
  const createdAt = DateTime.local();
  return (query: Query) =>
    query.subQuery((sub) =>
      sub
        .with('node')
        .match(
          flattened.map(({ variable, nodeLabel, id }) => [
            node(variable, nodeLabel, { id }),
          ])
        )
        .create(
          flattened.map(({ direction, relLabel, variable }) => [
            node('node'),
            relation(direction, '', relLabel, { active: true, createdAt }),
            node(variable),
          ])
        )
        .return(flattened.map((f) => f.variable))
    );
}
