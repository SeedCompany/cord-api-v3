import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { Maybe as Nullable } from 'graphql/jsutils/Maybe';
import { DateTime } from 'luxon';
import { ID, many } from '../../../common';
import { ResourceMap } from '../../../components/authorization/model/resource-map';

/**
 * Creates relationships to/from `node` to/from other base nodes.
 *
 * If the ID value is nil then the match & create is skipped.
 *
 * @example
 * createRelationships('out', {
 *   FundingAccount: { // base node label to match
 *     fundingAccount: // label of the relationship to create
 *      input.fundingAccountId, // id of the base node to match
 *   },
 *   User: { createdBy: input.creatorId } // simple one liner
 * })
 * // This above yields the below cypher
 * MATCH (fundingAccount:FundingAccount { id: $fundingAccountId }),
 *       (createdBy:User { id: $creatorId })
 * CREATE (node)-[:fundingAccount]->(fundingAccount),
 *        (node)-[:createdBy]->(createdBy)
 */
export const createRelationships =
  (
    direction: RelationDirection,
    labelsToRelationships: Partial<
      Record<keyof ResourceMap, Record<string, Nullable<ID> | readonly ID[]>>
    >
  ) =>
  (query: Query) => {
    const flattened = Object.entries(labelsToRelationships).flatMap(
      ([nodeLabel, relationships]) =>
        Object.entries(relationships ?? {}).flatMap(([prop, ids]) =>
          many(ids ?? []).map((id, i) => ({
            nodeLabel,
            id,
            relLabel: prop,
            variable: Array.isArray(ids) ? `${prop}${i}` : prop,
          }))
        )
    );

    const createdAt = DateTime.local();
    return query
      .match(
        flattened.map(({ variable, nodeLabel, id }) => [
          node(variable, nodeLabel, { id }),
        ])
      )
      .create(
        flattened.map(({ relLabel, variable }) => [
          node('node'),
          relation(direction, '', relLabel, { active: true, createdAt }),
          node(variable),
        ])
      );
  };
