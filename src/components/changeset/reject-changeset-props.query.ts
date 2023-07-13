import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ACTIVE, INACTIVE } from '../../core/database/query';

export interface RejectChangesetPropsOptions {
  nodeVar?: string;
  changesetVar?: string;
}

export const rejectChangesetProps =
  ({
    nodeVar = 'node',
    changesetVar = 'changeset',
  }: RejectChangesetPropsOptions = {}) =>
  (query: Query) => {
    query.subQuery([nodeVar, changesetVar], (body) =>
      body
        .comment('For all changed properties of node & changeset')
        .match([
          node(nodeVar),
          relation('out', 'changedRel', INACTIVE),
          node('changedProp', 'Property'),
          relation('in', 'changesetRel', 'changeset', ACTIVE),
          node(changesetVar),
        ])

        .comment('Apply previous relation to changeset rel')
        .delete('changesetRel')
        .create([
          node('changedProp'),
          relation('in', '', 'previous', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node(changesetVar),
        ])
        .return('1 as one'),
    );
  };
