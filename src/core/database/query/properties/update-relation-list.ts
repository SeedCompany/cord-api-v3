import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '~/common';
import { exp, variable, Variable } from '../index';

export interface UpdateRelationListOptions {
  node?: Variable;
  relation: string | Variable;
  newList: readonly ID[] | Variable;
}

export const updateRelationList =
  (options: UpdateRelationListOptions) =>
  <R>(query: Query<R>) => {
    const nodeName = options.node ?? variable('node');
    const now = query.params.addParam(DateTime.now(), 'now');
    const relName =
      options.relation instanceof Variable
        ? options.relation
        : variable(
            query.params.addParam(options.relation, 'relationName').toString(),
          );
    const newList =
      options.newList instanceof Variable
        ? options.newList
        : variable(
            query.params.addParam(options.newList, 'newList').toString(),
          );

    query.comment(
      `updateListProperty(${String(nodeName)}, ${String(relName)})`,
    );
    return query.subQuery([nodeName, relName, newList], (sub) =>
      sub
        .with([
          `${String(nodeName)} as parent`,
          `${String(relName)} as relName`,
          `${String(newList)} as childIds`,
        ])
        .subQuery(['parent', 'relName', 'childIds'], (sub) =>
          sub
            .match([
              node('parent'),
              relation('out', 'r'), // ACTIVE
              node('child', 'BaseNode'),
            ])
            .raw(`where type(r) = relName and not child.id in childIds`)
            .delete('r')
            // soft delete, cant usage without "permanentAfter" logic
            // .setVariables({
            //   'r.active': 'false',
            //   'r.deletedAt': String(now),
            // })
            .return('count(child) as deletedCount'),
        )
        .subQuery(['parent', 'relName', 'childIds'], (q) =>
          q
            .raw('unwind childIds as childId')
            .matchNode('child', 'BaseNode', { id: variable('childId') })
            .raw(
              `call apoc.merge.relationship(
                parent,
                relName,
                {}, // { active: true },
                { createdAt: ${String(now)} },
                child
              ) yield rel`,
            )
            .return('count(child) as totalCount'),
        )
        .return<{ stats: { deletedCount: number; totalCount: number } }>(
          exp({
            deletedCount: 'deletedCount',
            totalCount: 'totalCount',
          }).as('stats'),
        ),
    );
  };
