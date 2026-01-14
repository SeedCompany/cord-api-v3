import type { ConditionalKeys, IsAny, LiteralUnion, ValueOf } from 'type-fest';
import type { DBName, ResourceShape } from '~/common';
import type { ResourceDBMap, ResourceMap } from './map';

export type AllResourceAppNames = keyof ResourceMap;
export type AllResourceDBNames = DBName<ValueOf<ResourceDBMap>>;
export type AllResourceNames = AllResourceAppNames | AllResourceDBNames;
export type ResourceNameLike = LiteralUnion<AllResourceNames, string>;

//region ResourceName
/**
 * Given some sort of identifier for a resource type,
 * return our resource name if known, otherwise never.
 *
 * @example User
 * "User"           -> "User"
 * "default::User"  -> "User"
 * typeof User      -> "User"
 * User             -> "User"
 *
 * @example Including subclasses
 *
 * ResourceName<"Engagement", true>
 *   -> "Engagement" | "LanguageEngagement" | "InternshipEngagement"
 *
 * @example Edge Cases
 * any                  -> string
 * ResourceShape<any>   -> string
 * "foo"                -> never
 * Foo                  -> never
 */
export type ResourceName<T, IncludeSubclasses extends boolean = false> =
  IsAny<T> extends true
    ? AllResourceAppNames // short-circuit and prevent many seemly random circular definitions
    : T extends AllResourceDBNames
      ? ResourceNameFromStatic<
          ResourceMap[ResourceNameFromDBName<T>],
          IncludeSubclasses
        >
      : T extends AllResourceAppNames
        ? ResourceNameFromStatic<ResourceMap[T], IncludeSubclasses>
        : T extends ResourceShape<any>
          ? ResourceNameFromStatic<T, IncludeSubclasses>
          : ResourceNameFromInstance<T> extends string
            ? ResourceNameFromInstance<T, IncludeSubclasses> & string
            : never;

type ResourceNameFromInstance<
  TResource,
  IncludeSubclasses extends boolean = false,
> = {
  [Name in keyof ResourceMap]: ResourceMap[Name]['prototype'] extends TResource // Only self or subclasses
    ? IncludeSubclasses extends true
      ? Name
      : TResource extends ResourceMap[Name]['prototype'] // Exclude subclasses
        ? Name
        : never
    : never;
}[keyof ResourceMap];

type ResourceNameFromStatic<
  TResourceStatic extends ResourceShape<any>,
  IncludeSubclasses extends boolean = false,
> =
  ResourceShape<any> extends TResourceStatic
    ? string // short-circuit non-specific types
    : InstanceType<TResourceStatic> extends infer TResource
      ? {
          [Name in keyof ResourceMap]: InstanceType<
            ResourceMap[Name]
          > extends infer Other
            ? Other extends TResource // Only self or subclasses
              ? IncludeSubclasses extends true
                ? Name
                : TResource extends Other // Exclude subclasses
                  ? Name
                  : never
              : never
            : never;
        }[keyof ResourceMap]
      : never;

type ResourceNameFromDBName<Name extends AllResourceDBNames> =
  ConditionalKeys<
    ResourceDBMap,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    { __element__: { __name__: Name } }
  > extends infer AppName extends AllResourceAppNames
    ? AppName
    : never;
//endregion

export type ResourceStaticFromName<Name> = string extends Name
  ? ResourceShape<any>
  : Name extends keyof ResourceMap
    ? ValueOf<Pick<ResourceMap, Name>>
    : never;
