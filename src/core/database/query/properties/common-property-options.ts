import { type MergeExclusive } from 'type-fest';
import {
  type EnhancedResource,
  type ID,
  type MaybeUnsecuredInstance,
  type ResourceShape,
} from '~/common';
import { type DbChanges } from '../../changes';
import { type Variable } from '../index';

export type CommonPropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string,
> = MergeExclusive<
  {
    resource: TResourceStatic | EnhancedResource<TResourceStatic>;
    key: Key;
  },
  {
    /**
     * Update a dynamic property.
     * Note that this doesn't set labels declared in the DTO.
     */
    key: Variable;
  }
> & {
  changeset?: Variable;
  nodeName?: string;
  now?: Variable;
};
