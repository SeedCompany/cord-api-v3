import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { prefixNodeLabelsWithDeleted } from '../../core/database/query';

export interface CommitChangesetPropsOptions {
  nodeVar?: string;
  changesetVar?: string;
}

export const commitChangesetProps =
  ({
    nodeVar = 'node',
    changesetVar = 'changeset',
  }: CommitChangesetPropsOptions = {}) =>
  (query: Query) => {
    query.subQuery([nodeVar, changesetVar], (body) =>
      body
        .comment('For all changed properties of node & changeset')
        .match([
          node(nodeVar),
          relation('out', 'changedRel', { active: false }),
          node('changedProp', 'Property'),
          relation('in', '', 'changeset', { active: true }),
          node(changesetVar),
        ])

        .comment('Apply previous label to active prop')
        .subQuery([changesetVar, nodeVar, 'changedRel'], (sub) =>
          sub
            .match([
              node(nodeVar),
              relation('out', 'previouslyActiveRel', [], { active: true }),
              node('previouslyActiveProp', 'Property'),
            ])
            .raw(`WHERE type(previouslyActiveRel) = type(changedRel)`)
            .create([
              node('previouslyActiveProp'),
              relation('in', '', 'previous', {
                active: true,
                createdAt: DateTime.local(),
              }),
              node(changesetVar),
            ])
            .return(['previouslyActiveProp', 'previouslyActiveRel'])
        )
        .with(['changedRel', 'previouslyActiveProp', 'previouslyActiveRel'])

        .comment('Set changed prop to active')
        // must be after previously active is matched
        .setValues({ 'changedRel.active': true })

        .comment('Deactivate currently active prop')
        .setValues({ 'previouslyActiveRel.active': false })
        .with('previouslyActiveProp')
        .apply(prefixNodeLabelsWithDeleted('previouslyActiveProp'))

        .return('1')
    );
  };
