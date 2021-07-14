import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Variable } from '.';
import { ID, many, Many } from '../../../common';

export const addPreviousLabel =
  (
    key: string | Variable,
    changeset: ID,
    importVars: Many<string> = [],
    nodeName = 'node'
  ) =>
  (query: Query) =>
    query.comment`
      addPreviousLabel(${nodeName}.${key})
    `.subQuery([nodeName, ...many(importVars)], (sub) =>
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
            ? q.raw(`WHERE type(propRel) = ${key.name}`)
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
