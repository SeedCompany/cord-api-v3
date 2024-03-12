import { ConditionalKeys, IsAny, LiteralUnion, ValueOf } from 'type-fest';
import { DBName, ResourceShape } from '~/common';
import { ResourceDBMap, ResourceMap } from './map';

export type AllResourceNames = keyof ResourceMap;
export type AllResourceDBNames = DBName<ValueOf<ResourceDBMap>>;
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
export type ResourceName<
  T,
  IncludeSubclasses extends boolean = false,
> = IsAny<T> extends true
  ? AllResourceNames // short-circuit and prevent many seemly random circular definitions
  : T extends AllResourceDBNames
  ? ResourceNameFromStatic<
      ResourceMap[ResourceNameFromDBName<T>],
      IncludeSubclasses
    >
  : T extends AllResourceNames
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
> = ResourceShape<any> extends TResourceStatic
  ? string // short-circuit non-specific types
  : {
      [Name in keyof ResourceMap]: ResourceMap[Name] extends TResourceStatic // Only self or subclasses
        ? IncludeSubclasses extends true
          ? Name
          : TResourceStatic extends ResourceMap[Name] // Exclude subclasses
          ? Name
          : never
        : never;
    }[keyof ResourceMap];

type ResourceNameFromDBName<Name extends AllResourceDBNames> =
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ConditionalKeys<ResourceDBMap, { __element__: { __name__: Name } }>;
//endregion

export type ResourceStaticFromName<Name> = string extends Name
  ? ResourceShape<any>
  : Name extends keyof ResourceMap
  ? ValueOf<Pick<ResourceMap, Name>>
  : never;
