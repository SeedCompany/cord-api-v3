import { type Query } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  type ID,
  type MaybeUnsecuredInstance,
  type ResourceShape,
} from '~/common';
import { type DbChanges } from '../../changes';
import { apoc, collect, merge, Variable, variable } from '../index';
import { type PropUpdateStat, updateProperty } from './update-property';

export interface UpdatePropertiesOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
> {
  resource: TResourceStatic | EnhancedResource<TResourceStatic>;
  changes: DbChanges<TObject>;
  changeset?: Variable;
  nodeName?: string;
  outputStatsVar?: string;
  now?: DateTime | Variable;
}

export const updateProperties =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
  >({
    resource: resourceIn,
    changes,
    changeset,
    nodeName = 'node',
    outputStatsVar = 'stats',
    now,
  }: UpdatePropertiesOptions<TResourceStatic, TObject>) =>
  <R>(query: Query<R>) => {
    const resource = EnhancedResource.of(resourceIn);

    const propEntries = Object.entries(changes).flatMap(([key, value]) =>
      value !== undefined
        ? {
            key,
            value,
            labels: resource.dbPropLabels[key],
          }
        : [],
    );

    return query
      .comment(`updateProperties(${resource.dbLabel})`)
      .subQuery(nodeName, (sub) =>
        sub
          .unwind(propEntries, 'prop')
          .apply(
            updateProperty({
              key: variable('prop.key'),
              value: variable('prop.value'),
              labels: variable('prop.labels'),
              changeset,
              nodeName,
              now:
                now instanceof Variable
                  ? now
                  : query.params.addParam(now ?? DateTime.local(), 'now'),
            }),
          )
          .return<{
            stats: { [K in keyof DbChanges<TObject>]?: PropUpdateStat };
          }>(
            merge(collect(apoc.map.fromValues(['prop.key', 'stats']))).as(
              outputStatsVar,
            ),
          ),
      );
  };
