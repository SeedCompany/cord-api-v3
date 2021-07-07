import { node, Query, relation } from 'cypher-query-builder';
import { ID, MaybeUnsecuredInstance, ResourceShape } from '../../../common';
import { DbChanges } from '../changes';
import { prefixNodeLabelsWithDeleted } from './deletes';

export interface DeactivatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> {
  resource: TResourceStatic;
  key: Key;
  changeset?: ID;
  nodeName?: string;
  numDeactivatedVar?: string;
}

/**
 * Deactivates all existing properties of node and given key
 */
export const deactivateProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string
  >({
    key,
    changeset,
    nodeName = 'node',
    numDeactivatedVar = 'numPropsDeactivated',
  }: DeactivatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) =>
    query.comment`
      deactivateProperty(${nodeName}.${key})
    `.subQuery(nodeName, (sub) =>
      sub
        .match([
          node(nodeName),
          relation('out', 'oldToProp', key, { active: !changeset }),
          node('oldPropVar', 'Property'),
          ...(changeset
            ? [
                relation('in', 'oldChange', 'changeset', { active: true }),
                node('changeNode', 'Changeset', { id: changeset }),
              ]
            : []),
        ])
        .setValues({
          [`${changeset ? 'oldChange' : 'oldToProp'}.active`]: false,
        })
        .with('oldPropVar')
        .apply(prefixNodeLabelsWithDeleted('oldPropVar'))
        .return(`count(oldPropVar) as ${numDeactivatedVar}`)
    );
