import { Field, InterfaceType } from '@nestjs/graphql';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { ConditionalExcept, ConditionalPick } from 'type-fest';
import { cachedOnObject } from '~/common/weak-map-cache';
import { ScopedRole } from '../components/authorization';
import { DbLabel } from './db-label.decorator';
import { ServerException } from './exceptions';
import { ID, IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';
import { SecuredProps, UnsecuredDto } from './secured-property';
import { AbstractClassType } from './types';
import { has } from './util';

const hasTypename = (value: unknown): value is { __typename: string } =>
  value != null &&
  typeof value === 'object' &&
  has('__typename', value) &&
  typeof value.__typename === 'string';

@InterfaceType({
  resolveType: (value: unknown) => {
    if (hasTypename(value)) {
      return value.__typename;
    }

    throw new ServerException('Cannot resolve Resource type');
  },
})
@DbLabel('BaseNode')
export abstract class Resource {
  static readonly Props: string[] = keysOf<Resource>();
  static readonly SecuredProps: string[] = [];

  readonly __typename?: string;

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
  Relations?: Record<string, any>; // Many<ResourceShape<any>>
  /**
   * Define this resource as being a child of another.
   * This means it's _created_ and scoped under this other resource.
   * This _type_ cannot exist without this parent.
   */
  Parent?: Promise<any> | 'dynamic';
};

/**
 * A helper class to query the static info of a resource in a typed way.
 */
export class EnhancedResource<T extends ResourceShape<any>> {
  private constructor(readonly type: T) {}
  private static readonly refs = new WeakMap<
    ResourceShape<any>,
    EnhancedResource<any>
  >();

  static of<T extends ResourceShape<any>>(resource: T | EnhancedResource<T>) {
    if (resource instanceof EnhancedResource) {
      return resource;
    }
    const factory = () => new EnhancedResource(resource);
    return cachedOnObject(EnhancedResource.refs, resource, factory);
  }

  get name() {
    return this.type.name;
  }

  get hasParent() {
    return !!this.type.Parent;
  }

  @Once()
  get securedProps() {
    return new Set<SecuredResourceKey<T, false>>(this.type.SecuredProps as any);
  }

  @Once()
  get relationKeys() {
    return new Set<keyof T['Relations'] & string>(
      Object.keys(this.type.Relations ?? {}) as any
    );
  }

  @Once()
  get childRelationKeys() {
    return new Set<ChildRelationsKey<T>>(
      // TODO strip out non child relations
      Object.keys(this.type.Relations ?? {}) as any
    );
  }

  @Once()
  get securedPropsAndSingularRelationKeys() {
    return new Set<SecuredPropsAndSingularRelationsKey<T>>([
      ...this.securedProps,
      ...this.relationKeys,
    ]);
  }

  hasChildRelation(prop: string) {
    return (
      this.type.Relations &&
      prop in this.type.Relations &&
      Array.isArray(this.type.Relations[prop])
    );
  }
}

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

export type SecuredResourceKey<
  TResourceStatic extends ResourceShape<any>,
  IncludeRelations extends boolean | undefined = true
> = keyof SecuredResource<TResourceStatic, IncludeRelations> & string;

export type SecuredPropsAndSingularRelationsKey<
  TResourceStatic extends ResourceShape<any>
> = string &
  keyof (SecuredProps<TResourceStatic['prototype']> &
    ConditionalExcept<TResourceStatic['Relations'], any[]>);

export type ChildRelationsKey<TResourceStatic extends ResourceShape<any>> =
  keyof ConditionalPick<TResourceStatic['Relations'], any[]> & string;
