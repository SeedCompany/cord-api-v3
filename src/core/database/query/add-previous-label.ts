import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../../common';

export const addPreviousLabel =
  (key: string, changeset: ID, nodeName = 'node') =>
  (query: Query) =>
    query.comment`
      addPreviousLabel(${nodeName}.${key})
    `.subQuery(nodeName, (sub) =>
      sub
        .match(node('changeset', 'Changeset', { id: changeset }))
        .match([
          node(nodeName),
          relation('out', 'oldToProp', key, { active: true }),
          node('oldPropVar', 'Property'),
        ])
        .create([
          node('oldPropVar'),
          relation('in', '', 'previous', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('changeset'),
        ])
        .return('oldPropVar')
    );
