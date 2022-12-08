import { Query } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
} from '~/common';
import { updateProperty, variable } from '.';
import { DbChanges } from '../changes';

export interface UpdatePropertiesOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  }
> {
  resource: TResourceStatic | EnhancedResource<TResourceStatic>;
  changes: DbChanges<TObject>;
  changeset?: ID;
  nodeName?: string;
  numUpdatedVar?: string;
}

export const updateProperties =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    }
  >({
    resource,
    changes,
    changeset,
    nodeName = 'node',
    numUpdatedVar = 'numPropsUpdated',
  }: UpdatePropertiesOptions<TResourceStatic, TObject>) =>
  <R>(query: Query<R>) => {
    resource = EnhancedResource.of(resource);

    const propEntries = Object.entries(
      pickBy(changes, (value) => value !== undefined)
    ).map(([key, value]) => ({ key, value }));

    return query
      .comment(`updateProperties(${resource.dbLabel})`)
      .subQuery(nodeName, (sub) =>
        sub
          .unwind(propEntries, 'prop')
          .apply(
            updateProperty({
              key: variable('prop.key'),
              variable: 'prop.value',
              changeset,
              nodeName,
              now: query.params.addParam(DateTime.local(), 'now'),
            })
          )
          .return(`count(prop) as ${numUpdatedVar}`)
      );
  };
