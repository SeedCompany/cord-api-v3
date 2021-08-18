import { Field, InterfaceType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { assert } from 'ts-essentials';
import { keys as keysOf } from 'ts-transformer-keys';
import { ScopedRole } from '../components/authorization';
import { ID, IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';
import { SecuredProps, UnsecuredDto } from './secured-property';
import { AbstractClassType } from './types';
import { has } from './util';

@InterfaceType({
  resolveType: (value) => {
    assert(typeof value.__typename === 'string');
    return value.__typename;
  },
})
export abstract class Resource {
  static readonly Props: string[] = keysOf<Resource>();

  @IdField()
  readonly id: ID;

  @DateTimeField()
  readonly createdAt: DateTime;

  @Field({
    description: 'Whether the requesting user can delete this resource',
  })
  readonly canDelete: boolean;

  // A list of non-global roles the requesting user has available for this object.
  // This is used by the authorization module to determine permissions.
  readonly scope?: ScopedRole[];

  protected constructor() {
    // no instantiation, shape only
  }
}

export type ResourceShape<T> = AbstractClassType<T> & {
  Props: string[];
  SecuredProps: string[];
  // An optional list of props that exist on the BaseNode in the DB.
  // Default should probably be considered the props on Resource class.
  BaseNodeProps?: string[];
  Relations?: Record<string, any>;
};

export const isResourceClass = <T>(
  cls: AbstractClassType<T>
): cls is ResourceShape<T> =>
  has('Props', cls) && Array.isArray(cls.Props) && cls.Props.length > 0;

export type MaybeUnsecuredInstance<TResourceStatic extends ResourceShape<any>> =
  TResourceStatic['prototype'] | UnsecuredDto<TResourceStatic['prototype']>;

// Get the secured props of the resource
// merged with all of the relations which are assumed to be secure.
export type SecuredResource<
  Resource extends ResourceShape<any>,
  IncludeRelations extends boolean | undefined = true
> = SecuredProps<Resource['prototype']> &
  (IncludeRelations extends false ? unknown : Resource['Relations']);
