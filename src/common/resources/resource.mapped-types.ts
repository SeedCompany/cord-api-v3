import type { FnLike } from '@seedcompany/common';
import type { MaybeSecured, SecuredProps } from '~/common';
import type { $, e } from '~/core/gel/reexports';
import type { ResourceDBMap, ResourceName } from '~/core/resources';
import type { EnhancedResource } from './enhanced-resource';
import type { ResourceShape } from './resource-shape';

export type DBType<TResourceStatic extends ResourceShape<any>> =
  ResourceShape<any> extends TResourceStatic
    ? typeof e.Resource // short-circuit non-specific types
    : ResourceName<TResourceStatic> extends `${infer Name extends keyof ResourceDBMap}`
      ? ResourceDBMap[Name] extends infer T extends $.$expr_PathNode
        ? T
        : never
      : never;

/**
 * The name of the Gel type, it could be abstract.
 */
export type DBName<T extends $.TypeSet> = T['__element__']['__name__'];
/**
 * The name(s) of the concrete Gel types.
 * If the type is abstract, then it is a string union of the concrete type's names.
 * If the type is concrete, then it is just the name, just as {@link DBName}.
 */
export type DBNames<T extends $.ObjectTypeSet> =
  T['__element__']['__polyTypenames__'];

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

export type ExtraPropsFromRelationsKey<T extends ResourceShape<any>> = {
  [R in RelKey<T>]: RelOf<T>[R] extends ReadonlyArray<infer U>
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
  [R in RelKey<T>]: RelOf<T>[R] extends readonly any[]
    ? never
    : RelOf<T>[R] extends ResourceShape<any>
      ? RelOf<T>[R]['Parent'] extends {}
        ? R
        : never
      : never;
}[RelKey<T>];

export type ChildListsKey<T extends ResourceShape<any>> = {
  [R in RelKey<T>]: RelOf<T>[R] extends ReadonlyArray<infer U>
    ? U extends ResourceShape<any>
      ? U['Parent'] extends {}
        ? R
        : never
      : never
    : never;
}[RelKey<T>];

export interface EnhancedRelation<TResourceStatic extends ResourceShape<any>> {
  readonly name: RelKey<TResourceStatic>;
  /** Is the relationship One-to-Many */
  readonly list: boolean;
  readonly type: unknown;
  /** Enhanced resource of type, if type is resource */
  readonly resource?: EnhancedResource<any>;
}

type RelKey<T extends ResourceShape<any>> = keyof RelOf<T> & string;

type RelOf<T extends ResourceShape<any>> = T['Relations'] extends FnLike
  ? ReturnType<T['Relations']>
  : T['Relations'];
