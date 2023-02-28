import { node, Query } from 'cypher-query-builder';
import { ID } from '../../../common';
import { matchProps } from './matching';

export const matchChangesetAndChangedProps =
  (changeset?: ID) => (query: Query) => {
    query.comment`matchChangesetAndChangedProps()`;
    return changeset
      ? query
          .apply(
            matchProps({
              view: { changeset },
              outputVar: 'changedProps',
              optional: true,
            }),
          )
          .match(node('changeset', 'Changeset', { id: changeset }))
      : query.subQuery((sub) =>
          sub.return(['null as changeset', '{} as changedProps']),
        );
  };
