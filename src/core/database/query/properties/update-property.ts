import { Query } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, MaybeUnsecuredInstance, ResourceShape } from '~/common';
import { DbChanges } from '../../changes';
import { createProperty, CreatePropertyOptions } from './create-property';
import {
  deactivateProperty,
  DeactivatePropertyOptions,
} from './deactivate-property';

export type UpdatePropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
> = DeactivatePropertyOptions<TResourceStatic, TObject, Key> &
  CreatePropertyOptions<TResourceStatic, TObject, Key>;

/**
 * Deactivates all existing properties of the given key (if any) and then
 * creates a new property with the given value.
 */
export const updateProperty =
  <
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string
  >(
    options: UpdatePropertyOptions<TResourceStatic, TObject, Key>
  ) =>
  <R>(query: Query<R>) => {
    const resolved = {
      ...options,
      now: options.now ?? query.params.addParam(DateTime.now(), 'now'),
    };
    return query
      .apply(deactivateProperty<TResourceStatic, TObject, Key>(resolved))
      .apply(createProperty<TResourceStatic, TObject, Key>(resolved));
  };
