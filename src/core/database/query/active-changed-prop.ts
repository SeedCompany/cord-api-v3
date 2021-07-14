import { node, Query, relation } from 'cypher-query-builder';
import { Variable } from '.';
import { ID, many, Many } from '../../../common';

export const activeChangedProp =
  (
    key: string | Variable,
    changeset: ID,
    importVars: Many<string> = [],
    nodeName = 'node'
  ) =>
  (query: Query) =>
    query.comment`
      activeChangedProp(${nodeName}.${key})
    `.subQuery([nodeName, ...many(importVars)], (sub) =>
      sub
        .match([
          node(nodeName),
          relation('out', 'propRel', key instanceof Variable ? [] : key, {
            active: false,
          }),
          node('prop', 'Property'),
          relation('in', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changeset }),
        ])
        .apply((q) =>
          key instanceof Variable
            ? q.raw(`WHERE type(propRel) = ${key.name}`)
            : q
        )
        .setValues({ 'propRel.active': true })
        .return('prop')
    );
