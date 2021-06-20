import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { Maybe as Nullable } from 'graphql/jsutils/Maybe';
import { DateTime } from 'luxon';
import { ID } from '../../../common';
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
 * MATCH (fundingAccount:FundingAccount { id: $fundingAccountId })
 * CREATE (node)-[:fundingAccount]->(fundingAccount)
 * MATCH (createdBy:User { id: $creatorId })
 * CREATE (node)-[:createdBy]->(createdBy)
 */
export const createRelationships =
  (
    direction: RelationDirection,
    labelsToRelationships: Partial<
      Record<keyof ResourceMap, Record<string, Nullable<ID>>>
    >
  ) =>
  (query: Query) => {
    for (const [label, relationships] of Object.entries(
      labelsToRelationships
    )) {
      for (const [prop, id] of Object.entries(relationships ?? {})) {
        if (!id) {
          continue;
        }
        query.match([node(prop, label, { id })]).create([
          node('node'),
          relation(direction, '', prop, {
            active: true,
            createdAt: DateTime.local(),
          }),
          node(prop),
        ]);
      }
    }
  };
