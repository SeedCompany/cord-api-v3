import { Field, InterfaceType } from '@nestjs/graphql';
import { cached, FnLike, mapValues } from '@seedcompany/common';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { inspect } from 'util';
import type { ResourceDBMap, ResourceMap } from '~/core';
import { $, e } from '~/core/edgedb/reexports';
import { ScopedRole } from '../components/authorization';
import { CalculatedSymbol } from './calculated.decorator';
import { DataObject } from './data-object';
import { DbLabel } from './db-label.decorator';
import { getDbClassLabels, getDbPropertyLabels } from './db-label.helpers';
import { ServerException } from './exceptions';
import { ID, IdField } from './id-field';
import { DateTimeField } from './luxon.graphql';
import { getParentTypes } from './parent-types';
import { MaybeSecured, SecuredProps } from './secured-property';
import { AbstractClassType } from './types';

const hasTypename = (value: unknown): value is { __typename: string } =>
  value != null &&
  typeof value === 'object' &&
  '__typename' in value &&
  typeof value.__typename === 'string';

export const resolveByTypename =
  (interfaceName: string) => (value: unknown) => {
    if (hasTypename(value)) {
      return value.__typename;
    }
    throw new ServerException(`Cannot resolve ${interfaceName} type`);
  };

@InterfaceType({
  resolveType: resolveByTypename(Resource.name),
})
@DbLabel('BaseNode')
export abstract class Resource extends DataObject {
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
}

type Thunk<T> = T | (() => T);

export type ResourceShape<T> = AbstractClassType<T> & {
  Props: string[];
  SecuredProps: string[];
  // An optional list of props that exist on the BaseNode in the DB.
  // Default should probably be considered the props on Resource class.
  BaseNodeProps?: string[];
  Relations?: Thunk<
    Record<string, ResourceShape<any> | [ResourceShape<any>] | undefined>
  >;
  /**
   * Define this resource as being a child of another.
   * This means it's _created_ and scoped under this other resource.
   * This _type_ cannot exist without this parent.
   */
  Parent?: Promise<any> | 'dynamic';
};

export type ResourceRelationsShape = ResourceShape<any>['Relations'];

/**
 * A helper class to query the static info of a resource in a typed way.
 */
export class EnhancedResource<T extends ResourceShape<any>> {
  /** @internal */
  static readonly dbTypes = new WeakMap<ResourceShape<any>, $.$expr_PathNode>();

  private constructor(readonly type: T) {}
  private static readonly refs = new WeakMap<
    ResourceShape<any>,
    EnhancedResource<any>
  >();

  static of<T extends ResourceShape<any>>(
    resource: T | EnhancedResource<T>,
  ): EnhancedResource<T> {
    if (resource instanceof EnhancedResource) {
      return resource;
    }
    const factory = () => new EnhancedResource(resource);
    return cached(EnhancedResource.refs, resource, factory);
  }

  [inspect.custom]() {
    return `${this.constructor.name} { ${this.name} }`;
  }

  /**
   * Check if the given type is the same as this type.
   * A helper to narrow the type of enhanced resource.
   *
   * This doesn't narrow though when T is `any`.
   */
  is<S extends ResourceShape<any>>(clsType: S): this is EnhancedResource<S> {
    return Object.is(this.type, clsType);
  }

  /**
   * Check if the given type is the same as this type.
   * If it is, then this is returned otherwise undefined.
   * This should help to narrow with null coalescing when {@link is} isn't viable.
   */
  as<S extends ResourceShape<any>>(
    clsType: S,
  ): EnhancedResource<S> | undefined {
    return Object.is(this.type, clsType)
      ? // If check passes then T and S are the same.
        (this as unknown as EnhancedResource<S>)
      : undefined;
  }

  get name(): ResourceName<T> {
    return this.type.name as any;
  }

  /**
   * An ordered set of interfaces the resource.
   *
   * Note: This doesn't work with mapped types
   * i.e. {@link import('@nestjs/graphql').IntersectionType}
   */
  @Once()
  get interfaces(): ReadonlySet<EnhancedResource<any>> {
    return new Set(
      getParentTypes(this.type)
        .slice(1) // not self
        .filter(isResourceClass)
        .map(EnhancedResource.of),
    );
  }

  get hasParent() {
    return !!this.type.Parent;
  }

  @Once()
  get securedPropsPlusExtra(): ReadonlySet<
    SecuredResourceKey<T, false> | ExtraPropsFromRelationsKey<T>
  > {
    return new Set([...this.securedProps, ...this.extraPropsFromRelations]);
  }

  @Once()
  get props(): ReadonlySet<keyof T['prototype'] & string> {
    return new Set<keyof T['prototype'] & string>(this.type.Props as any);
  }

  @Once()
  get securedProps(): ReadonlySet<SecuredResourceKey<T, false>> {
    return new Set<SecuredResourceKey<T, false>>(this.type.SecuredProps as any);
  }

  @Once()
  get childKeys(): ReadonlySet<ChildSinglesKey<T> | ChildListsKey<T>> {
    return new Set([...this.childSingleKeys, ...this.childListKeys]);
  }

  @Once()
  get extraPropsFromRelations() {
    return this.relNamesIf<ExtraPropsFromRelationsKey<T>>(
      (rel) => !rel.resource?.hasParent,
    );
  }

  @Once()
  get childSingleKeys() {
    return this.relNamesIf<ChildSinglesKey<T>>(
      (rel) => !rel.list && !!rel.resource?.hasParent,
    );
  }

  @Once()
  get childListKeys() {
    return this.relNamesIf<ChildListsKey<T>>(
      (rel) => rel.list && !!rel.resource?.hasParent,
    );
  }

  private relNamesIf<K>(
    predicate: (rel: EnhancedRelation<any>) => boolean,
  ): ReadonlySet<K> {
    return new Set<K>(
      [...this.relations.values()].flatMap((rel) =>
        predicate(rel) ? (rel.name as K) : [],
      ),
    );
  }

  @Once()
  get relations(): ReadonlyMap<RelKey<T>, EnhancedRelation<T>> {
    const rawRels =
      typeof this.type.Relations === 'function'
        ? this.type.Relations()
        : this.type.Relations ?? {};
    return new Map(
      Object.entries(rawRels).map(([rawName, rawType]) => {
        const name = rawName as RelKey<T>;
        const list = Array.isArray(rawType);
        const type: ResourceShape<any> | undefined = list
          ? rawType[0]!
          : rawType;
        const resource: EnhancedResource<any> | undefined =
          type && isResourceClass(type) ? EnhancedResource.of(type) : undefined;
        const rel: EnhancedRelation<T> = { name, list, type, resource };
        return [name, rel];
      }),
    );
  }

  @Once()
  get isCalculated() {
    return !!Reflect.getMetadata(CalculatedSymbol, this.type);
  }

  @Once()
  get calculatedProps(): ReadonlySet<keyof T['prototype'] & string> {
    const props = [...this.props].filter((prop) => {
      return !!Reflect.getMetadata(CalculatedSymbol, this.type.prototype, prop);
    });
    return new Set(props);
  }

  get db(): DBType<T> {
    const type = EnhancedResource.dbTypes.get(this.type);
    if (!type) {
      throw new ServerException(`No DB type defined for ${this.name}`);
    }
    return type as any;
  }

  get dbFQN(): ResourceShape<any> extends T ? string : DBName<DBType<T>> {
    return this.db.__element__.__name__ as any;
  }

  @Once()
  get dbLabels() {
    return getDbClassLabels(this.type);
  }
  get dbLabel() {
    return this.dbLabels[0];
  }
  @Once()
  get dbPropLabels(): {
    readonly [K in keyof T['prototype'] & string]?: readonly string[];
  } {
    return mapValues.fromList(this.props, (prop) =>
      getDbPropertyLabels(this.type, prop),
    ).asRecord;
  }
}

export interface EnhancedRelation<TResourceStatic extends ResourceShape<any>> {
  readonly name: RelKey<TResourceStatic>;
  /** Is the relationship One-to-Many */
  readonly list: boolean;
  readonly type: unknown;
  /** Enhanced resource of type, if type is resource */
  readonly resource?: EnhancedResource<any>;
}

export const isResourceClass = <T>(
  cls: AbstractClassType<T>,
): cls is ResourceShape<T> =>
  'Props' in cls && Array.isArray(cls.Props) && cls.Props.length > 0;

export type ResourceName<TResourceStatic extends ResourceShape<any>> =
  ResourceShape<any> extends TResourceStatic
    ? string // short-circuit non-specific types
    : {
        [Name in keyof ResourceMap]: ResourceMap[Name] extends TResourceStatic // Only self or subclasses
          ? TResourceStatic extends ResourceMap[Name] // Exclude subclasses
            ? Name
            : never
          : never;
      }[keyof ResourceMap] &
        string;

export type DBType<TResourceStatic extends ResourceShape<any>> =
  ResourceShape<any> extends TResourceStatic
    ? typeof e.Resource // short-circuit non-specific types
    : ResourceName<TResourceStatic> extends keyof ResourceDBMap
    ? ResourceDBMap[ResourceName<TResourceStatic>] extends infer T extends $.$expr_PathNode
      ? T
      : never
    : never;

export type DBName<T extends $.TypeSet> = T['__element__']['__name__'];

export type MaybeUnsecuredInstance<TResourceStatic extends ResourceShape<any>> =
  MaybeSecured<InstanceType<TResourceStatic>>;

// Get the secured props of the resource
// merged with all of the relations which are assumed to be secure.
export type SecuredResource<
  Resource extends ResourceShape<any>,
  IncludeRelations extends boolean | undefined = true,
> = SecuredProps<Resource['prototype']> &
  (IncludeRelations extends false ? unknown : RelOf<Resource>);

export type SecuredResourceKey<
  TResourceStatic extends ResourceShape<any>,
  IncludeRelations extends boolean | undefined = true,
> = keyof SecuredResource<TResourceStatic, IncludeRelations> & string;

export type SecuredPropsPlusExtraKey<
  TResourceStatic extends ResourceShape<any>,
> =
  | (keyof SecuredProps<TResourceStatic['prototype']> & string)
  | ExtraPropsFromRelationsKey<TResourceStatic>;

/* eslint-disable @typescript-eslint/ban-types -- {} is used to mean non-nullable, it's not an empty interface */

export type ExtraPropsFromRelationsKey<T extends ResourceShape<any>> = {
  [R in RelKey<T>]: RelOf<T>[R] extends Array<infer U>
    ? U extends ResourceShape<any>
      ? U['Parent'] extends {}
        ? never
        : R
      : R
    : RelOf<T>[R] extends ResourceShape<any>
    ? RelOf<T>[R]['Parent'] extends {}
      ? never
      : R
    : R;
}[RelKey<T>];

export type ChildSinglesKey<T extends ResourceShape<any>> = {
  [R in RelKey<T>]: RelOf<T>[R] extends any[]
    ? never
    : RelOf<T>[R] extends ResourceShape<any>
    ? RelOf<T>[R]['Parent'] extends {}
      ? R
      : never
    : never;
}[RelKey<T>];

export type ChildListsKey<T extends ResourceShape<any>> = {
  [R in RelKey<T>]: RelOf<T>[R] extends Array<infer U>
    ? U extends ResourceShape<any>
      ? U['Parent'] extends {}
        ? R
        : never
      : never
    : never;
}[RelKey<T>];

type RelKey<T extends ResourceShape<any>> = keyof RelOf<T> & string;

type RelOf<T extends ResourceShape<any>> = T['Relations'] extends FnLike
  ? ReturnType<T['Relations']>
  : T['Relations'];
