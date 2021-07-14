import { node, Query, relation } from 'cypher-query-builder';
import { Variable } from '.';
import { ID } from '../../../common';

export const activeChangedProp =
  (key: string | Variable, changeset: ID, nodeName = 'node') =>
  (query: Query) =>
    query.comment`
      activeChangedProp(${nodeName}.${key})
    `.subQuery(
      key instanceof Variable ? [nodeName, key.name] : [nodeName],
      (sub) =>
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
              ? q.raw(`WHERE type(propRel) = type(${key.name})`)
              : q
          )
          .setValues({ 'propRel.active': true })
          .return('prop')
    );
