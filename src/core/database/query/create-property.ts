import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { Variable } from '.';
import {
  getDbPropertyLabels,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
  UnwrapSecured,
} from '../../../common';
import { DbChanges } from '../changes';
import { determineSortValue } from '../query.helpers';

export interface CreatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> {
  resource: TResourceStatic;
  key: Key;
  value: UnwrapSecured<TObject[Key]> | Variable;
  changeset?: ID;
  nodeName?: string;
  numCreatedVar?: string;
}

/**
 * Creates a new property from the node var with given key/value.
 */
export const createProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string
  >({
    resource,
    key,
    value,
    changeset,
    nodeName = 'node',
    numCreatedVar = 'numPropsCreated',
  }: CreatePropertyOptions<TResourceStatic, TObject, Key>) =>
  <R>(query: Query<R>) => {
    const createdAt = DateTime.local();
    const propLabels = !changeset
      ? getDbPropertyLabels(resource, key)
      : // Do not give properties unique labels if inside a changeset.
        // They'll get them when they are applied for real.
        ['Property'];

    return query.subQuery(nodeName, (sub) =>
      sub
        .apply((q) =>
          changeset
            ? q
                .match(node('changeset', 'Changeset', { id: changeset }))
                // Don't create new "change value" if the value is the same as
                // the value outside the changeset.
                .raw(
                  `WHERE NOT (${nodeName})-[:${key} { active: true }]->(:Property { value: $value })`,
                  {
                    value,
                  }
                )
            : q
        )
        .create([
          node(nodeName),
          relation('out', 'toProp', key, {
            active: !changeset,
            createdAt,
          }),
          node('newPropNode', propLabels, {
            createdAt,
            value,
            sortValue: determineSortValue(value),
          }),
          ...(changeset
            ? [
                relation('in', '', 'changeset', { active: true }),
                node('changeset'),
              ]
            : []),
        ])
        .return(`count(newPropNode) as ${numCreatedVar}`)
    );
  };
