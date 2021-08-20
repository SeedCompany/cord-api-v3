import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import { Variable } from '.';
import {
  ID,
  many,
  Many,
  MaybeUnsecuredInstance,
  ResourceShape,
} from '../../../common';
import { DbChanges } from '../changes';
import { prefixNodeLabelsWithDeleted } from './deletes';

export type DeactivatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = MergeExclusive<
  {
    resource: TResourceStatic;
    key: Key;
  },
  {
    key: Variable;
  }
> & {
  changeset?: ID;
  nodeName?: string;
  numDeactivatedVar?: string;
  importVars?: Many<string>;
};

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
    importVars = [],
  }: DeactivatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) =>
    query.comment`
      deactivateProperty(${nodeName}.${key})
    `.subQuery([nodeName, ...many(importVars)], (sub) =>
      sub
        .match([
          node(nodeName),
          relation('out', 'oldToProp', key instanceof Variable ? [] : key, {
            active: !changeset,
          }),
          node('oldPropVar', 'Property'),
          ...(changeset
            ? [
                relation('in', 'oldChange', 'changeset', { active: true }),
                node('changeNode', 'Changeset', { id: changeset }),
              ]
            : []),
        ])
        .apply((q) =>
          key instanceof Variable
            ? q.raw(`WHERE type(oldToProp) = ${key.name}`)
            : q
        )
        .setValues({
          [`${changeset ? 'oldChange' : 'oldToProp'}.active`]: false,
          'oldPropVar.deletedAt': DateTime.local(),
        })
        .with('oldPropVar')
        .apply(prefixNodeLabelsWithDeleted('oldPropVar'))
        .return(`count(oldPropVar) as ${numDeactivatedVar}`)
    );
