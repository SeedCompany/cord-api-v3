import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import { ACTIVE, variable as varRef } from '.';
import {
  getDbPropertyLabels,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
  UnwrapSecured,
} from '../../../common';
import { DbChanges } from '../changes';

export type CreatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = {
  resource: TResourceStatic;
  key: Key;
  changeset?: ID;
  nodeName?: string;
  numCreatedVar?: string;
} & MergeExclusive<
  {
    /** The new value which will be a bound parameter */
    value: UnwrapSecured<TObject[Key]>;
  },
  {
    /** The variable to use as the new value */
    variable: string;
  }
>;

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
    variable,
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

    const imports = [
      nodeName,
      // Try to pull the root variable referenced from expression https://regex101.com/r/atshF5
      (variable ? /(?:.+\()?([^.]+)\.?.*/.exec(variable)?.[1] : null) ?? '',
    ];
    return query.comment`
      createProperty(${nodeName}.${key})
    `.subQuery(imports, (sub) =>
      sub
        .apply((q) =>
          changeset
            ? q
                .match(node('changeset', 'Changeset', { id: changeset }))
                // Don't create new "change value" if the value is the same as
                // the value outside the changeset.
                .raw(
                  `WHERE NOT (${nodeName})-[:${key} { active: true }]->(:Property { value: ${
                    variable ? variable : '$value'
                  } })`,
                  variable ? {} : { value }
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
            value: variable ? varRef(variable) : value,
          }),
          ...(changeset
            ? [relation('in', '', 'changeset', ACTIVE), node('changeset')]
            : []),
        ])
        .return(`count(newPropNode) as ${numCreatedVar}`)
    );
  };
