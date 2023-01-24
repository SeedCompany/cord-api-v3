import { MergeExclusive } from 'type-fest';
import {
  EnhancedResource,
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
} from '~/common';
import { DbChanges } from '../../changes';
import { Variable } from '../index';

export type CommonPropertyOptions<
  TResourceStatic extends ResourceShape<any>,
  TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
    id: ID;
  },
  Key extends keyof DbChanges<TObject> & string
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
  changeset?: ID;
  nodeName?: string;
  now?: Variable;
};
