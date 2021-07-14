import { node, Query, relation } from 'cypher-query-builder';
import { ID } from '../../../common';

export const activeChangedProp =
  (key: string, changeset: ID, nodeName = 'node') =>
  (query: Query) =>
    query.comment`
      activeChangedProp(${nodeName}.${key})
    `.subQuery(nodeName, (sub) =>
      sub
        .match([
          node(nodeName),
          relation('out', 'changedPropRel', key, { active: false }),
          node('prop', 'Property'),
          relation('in', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changeset }),
        ])
        .setValues({ 'changedPropRel.active': true })
        .return('prop')
    );
