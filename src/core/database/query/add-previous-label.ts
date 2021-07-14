import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Variable } from '.';
import { ID } from '../../../common';

export const addPreviousLabel =
  (key: string | Variable, changeset: ID, nodeName = 'node') =>
  (query: Query) =>
    query.comment`
      addPreviousLabel(${nodeName}.${key})
    `.subQuery(
      key instanceof Variable ? [nodeName, key.name] : [nodeName],
      (sub) =>
        sub
          .match(node('changeset', 'Changeset', { id: changeset }))
          .match([
            node(nodeName),
            relation('out', 'propRel', key instanceof Variable ? [] : key, {
              active: true,
            }),
            node('propVar', 'Property'),
          ])
          .apply((q) =>
            key instanceof Variable
              ? q.raw(`WHERE type(propRel) = type(${key.name})`)
              : q
          )
          .create([
            node('propVar'),
            relation('in', '', 'previous', {
              active: true,
              createdAt: DateTime.local(),
            }),
            node('changeset'),
          ])
          .return('propVar')
    );
