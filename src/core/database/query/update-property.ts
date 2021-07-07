import { Query } from 'cypher-query-builder';
import { ID, MaybeUnsecuredInstance, ResourceShape } from '../../../common';
import { DbChanges } from '../changes';
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
 * Deactivates all existing properties of given key (if any) and then
 * creates a new property with given value.
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
  <R>(query: Query<R>) =>
    query
      .apply(deactivateProperty<TResourceStatic, TObject, Key>(options))
      .apply(createProperty<TResourceStatic, TObject, Key>(options));
