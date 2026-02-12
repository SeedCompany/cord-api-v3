import {
  asNonEmptyArray,
  cached,
  type FnLike,
  mapValues,
  CachedGetter as Once,
  setInspectOnClass,
  setToJson,
} from '@seedcompany/common';
import { DbLabel } from '~/common/db';
import { CalculatedSymbol } from '~/common/decorators';
import { ServerException } from '~/common/exceptions';
import { getParentTypes } from '~/common/functions';
import { GqlClassType } from '~/common/graphql/decorators/class-type.decorator';
import type { $ } from '~/core/gel/reexports';
import type {
  ResourceLike,
  ResourceName,
  ResourcesHost,
} from '~/core/resources';
import type { ResourceShape } from './resource-shape';
import type {
  ChildListsKey,
  ChildSinglesKey,
  DBName,
  DBType,
  EnhancedRelation,
  ExtraPropsFromRelationsKey,
  SecuredResourceKey,
} from './resource.mapped-types';

/**
 * A helper class to query the static info of a resource in a typed way.
 */
export class EnhancedResource<T extends ResourceShape<any>> {
  /** @internal */
  static readonly dbTypes = new WeakMap<ResourceShape<any>, $.$expr_PathNode>();
  /** @internal */
  static readonly dbSkipAccessPolicies = new Set<string>();
  /** @internal */
  static resourcesHost?: ResourcesHost;

  private constructor(readonly type: T) {}
  private static readonly refs = new WeakMap<
    ResourceShape<any>,
    EnhancedResource<any>
  >();

  static resolve(ref: ResourceLike) {
    // Safety check; since this very dynamic code, it is very possible the types are lying.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (ref == null) {
      throw new ServerException('Resource reference is actually null');
    }
    if (typeof ref !== 'string') {
      return EnhancedResource.of(ref);
    }
    if (!EnhancedResource.resourcesHost) {
      throw new ServerException('Cannot resolve without ResourcesHost');
    }
    return EnhancedResource.resourcesHost.enhance(ref);
  }

  static of<T extends ResourceShape<any>>(
    resource: T | EnhancedResource<T>,
  ): EnhancedResource<T> {
    if (resource instanceof EnhancedResource) {
      return resource;
    }
    const factory = () => new EnhancedResource(resource);
    return cached(EnhancedResource.refs, resource, factory);
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
   * A semi-ordered set of interfaces the resource.
   */
  @Once()
  get interfaces(): ReadonlySet<EnhancedResource<any>> {
    return new Set(
      getParentTypes(this.type, [])
        .filter(
          (cls): cls is ResourceShape<any> =>
            // Is declared as interface. i.e. avoids DataObject.
            GqlClassType.get(cls) === 'interface' &&
            // Avoid intersected classes.
            // getParentTypes will give us the intersect-ees directly.
            !cls.name.startsWith('Intersection'),
        )
        .map(EnhancedResource.of),
    );
  }

  get hasParent() {
    return !!this.type.Parent;
  }
  get isEmbedded() {
    return this.type.Parent === 'dynamic';
  }

  @Once()
  get securedPropsPlusExtra(): ReadonlySet<
    SecuredResourceKey<T, false> | ExtraPropsFromRelationsKey<T>
  > {
    return new Set([...this.securedProps, ...this.extraPropsFromRelations]);
  }

  @Once()
  get props(): ReadonlySet<keyof T['prototype'] & string> {
    const props = this.type.Props;
    if (!props) {
      throw new Error(
        `${this.name} has no props declared.\n\nDecorate with @RegisterResource or a GraphQL type decorator and move it to a file named: *.dto.ts.`,
      );
    }
    return new Set<keyof T['prototype'] & string>(props);
  }

  @Once()
  get securedProps(): ReadonlySet<SecuredResourceKey<T, false>> {
    const props = this.type.SecuredProps;
    if (!props) {
      throw new Error(
        `${this.name} has no props declared.\n\nDecorate with @RegisterResource or a GraphQL type decorator and move it to a file named: *.dto.ts.`,
      );
    }
    return new Set<SecuredResourceKey<T, false>>(props as any);
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
        : (this.type.Relations ?? {});
    return new Map(
      Object.entries(rawRels).map(([rawName, rawType]) => {
        const name = rawName as RelKey<T>;
        const list = Array.isArray(rawType);
        const type: ResourceShape<any> | undefined = list
          ? rawType[0]!
          : rawType;
        const resource: EnhancedResource<any> | undefined = type?.prototype
          ? EnhancedResource.of(type)
          : undefined;
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

  get hasDB() {
    return !!EnhancedResource.dbTypes.get(this.type);
  }
  get db(): DBType<T> {
    const type = EnhancedResource.dbTypes.get(this.type);
    if (!type) {
      throw new ServerException(`No DB type defined for ${this.name}`);
    }
    return type as any;
  }

  get generateAccessPolicies() {
    return this.hasDB && !EnhancedResource.dbSkipAccessPolicies.has(this.dbFQN);
  }

  get dbFQN(): ResourceShape<any> extends T ? string : DBName<DBType<T>> {
    return this.db.__element__.__name__ as any;
  }

  @Once()
  get dbLabels() {
    const labels = getParentTypes(this.type).flatMap((cls) => {
      if (
        // Is declared as some gql object. i.e. avoids DataObject.
        !GqlClassType.get(cls) ||
        // Avoid intersected classes.
        // getParentTypes will give us the intersect-ees directly.
        cls.name.startsWith('Intersection')
      ) {
        return [];
      }
      const declared = DbLabel.getOwn(cls);
      return declared ? [...declared] : [cls.name];
    });
    return asNonEmptyArray([...new Set([...labels, 'BaseNode'])])!;
  }
  get dbLabel() {
    return this.dbLabels[0];
  }
  @Once()
  get dbPropLabels(): {
    readonly [K in keyof T['prototype'] & string]?: readonly string[];
  } {
    return mapValues.fromList(this.props, (prop) => {
      const declared = DbLabel.get(this.type, prop as unknown as string);
      return [...new Set([...(declared ?? []), 'Property'])];
    }).asRecord;
  }
}
setInspectOnClass(EnhancedResource, (res) => ({ collapsed }) => {
  return collapsed(res.name, 'Enhanced');
});
setToJson(EnhancedResource, (res) => ({ name: res.name }));

type RelKey<T extends ResourceShape<any>> = keyof RelOf<T> & string;

type RelOf<T extends ResourceShape<any>> = T['Relations'] extends FnLike
  ? ReturnType<T['Relations']>
  : T['Relations'];
