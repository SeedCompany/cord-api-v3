import { Query } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
} from '~/common';
import { DbChanges } from '../../changes';
import { apoc, collect, merge, Variable, variable } from '../index';
import { PropUpdateStat, updateProperty } from './update-property';

export interface UpdatePropertiesOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  }
> {
  resource: TResourceStatic | EnhancedResource<TResourceStatic>;
  changes: DbChanges<TObject>;
  changeset?: Variable;
  nodeName?: string;
  outputStatsVar?: string;
}

export const updateProperties =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    }
  >({
    resource: resourceIn,
    changes,
    changeset,
    nodeName = 'node',
    outputStatsVar = 'stats',
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
        : []
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
              now: query.params.addParam(DateTime.local(), 'now'),
            })
          )
          .return<{
            stats: { [K in keyof DbChanges<TObject>]?: PropUpdateStat };
          }>(
            merge(collect(apoc.map.fromValues(['prop.key', 'stats']))).as(
              outputStatsVar
            )
          )
      );
  };
