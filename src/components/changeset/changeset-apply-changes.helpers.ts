import { node, Query, relation } from 'cypher-query-builder';
import { ID, ResourceShape } from '../../common';
import {
  activeChangedProp,
  addPreviousLabel,
  deactivateProperty,
  variable,
} from '../../core/database/query';

export interface ApplyChangesetChangesOptions<
  TResourceStatic extends ResourceShape<any>
> {
  type: TResourceStatic;
  changeset: ID;
  nodeVar?: string;
  changesetVar?: string;
}

export const changesetApplyChanges =
  <TResourceStatic extends ResourceShape<any>>({
    type,
    changeset,
    nodeVar = 'node',
    changesetVar = 'changeset',
  }: ApplyChangesetChangesOptions<TResourceStatic>) =>
  (query: Query) => {
    query.subQuery([nodeVar, changesetVar], (sub) =>
      sub
        .match([
          node('node'),
          relation('out', 'relationToProp', { active: false }),
          node('changedProp', 'Property'),
          relation('in', '', 'changeset', { active: true }),
          node('changeset'),
        ])
        // Apply previous label to active prop
        .apply(
          addPreviousLabel(variable('type(relationToProp)'), changeset, [
            'relationToProp',
          ])
        )
        // Deactivate active prop
        .apply(
          deactivateProperty({
            key: variable('type(relationToProp)'),
            resource: type,
            importVars: ['relationToProp'],
          })
        )
        // Set changed prop to active
        .apply(
          activeChangedProp(variable('type(relationToProp)'), changeset, [
            'relationToProp',
          ])
        )
        .return('1')
    );
  };
