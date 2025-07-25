import { entries } from '@seedcompany/common';
import { difference, omit, pickBy } from 'lodash';
import { DateTime } from 'luxon';
import type { ConditionalKeys, IsAny } from 'type-fest';
import {
  EnhancedResource,
  type ID,
  type MaybeSecured,
  type MaybeUnsecuredInstance,
  Resource,
  type ResourceShape,
  unwrapSecured,
  type UnwrapSecured,
} from '~/common';
import { type LinkTo } from '~/core';
import { type CreateDefinedFileVersionInput } from '../../components/file/dto';
import { type Variable } from './query';
import { type NativeDbValue } from './results';

/**
 * Specify this on a property to override the key & value type for ChangesOf on
 * the object.
 *
 * @example
 * class Foo {
 *   color: string & SetChangeType<'hexColor', number>
 * }
 * const changes: ChangesOf<Foo> = {
 *   hexColor: 0xFFFFFF,
 * };
 */
export interface SetChangeType<Key, Value> {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- shush we are hiding this. It's only for TS types.
  __update_type__?: { key: Key; value: Value };
}

export type AnyChangesOf<T> = {
  [Key in keyof T & string as ChangeKey<
    Exclude<Key, keyof Resource>,
    T
  >]?: ChangeOf<T[Key]>;
} & {
  // allow id to be passed in and removed from changes as it's what we are doing
  // all over the app.
  id?: ID;
};

export type ChangesOf<
  TResource,
  Changes extends AnyChangesOf<TResource>,
> = Partial<Omit<Changes, keyof Resource> & AndModifiedAt<TResource>>;

type ChangeKey<Key extends keyof T & string, T> = T[Key] extends SetChangeType<
  infer Override,
  any
>
  ? Override extends string
    ? Override
    : never
  : UnwrapSecured<T[Key]> & {} extends infer Value
  ? IsFileField<Value> extends true
    ? Key // our file input fields don't add id suffix, because they are objects.
    : Value extends ID | LinkTo<any>
    ? `${Key}Id` // our convention for single relationships
    : Key
  : never;

type ChangeOf<Val> = Val extends SetChangeType<any, infer Override>
  ? Override
  :
      | RawChangeOf<UnwrapSecured<Val> & {}>
      | (null extends UnwrapSecured<Val> ? null : never);

export type RawChangeOf<Val> = IsFileField<Val> extends true
  ? CreateDefinedFileVersionInput
  : Val extends LinkTo<infer X>
  ? ID<X>
  : Val extends ReadonlyArray<LinkTo<infer X>>
  ? ReadonlyArray<ID<X>>
  : Val;

type IsFileField<Val> = Val extends LinkTo<'File'>
  ? true
  : Val extends ID<infer IDType>
  ? IsAny<IDType> extends true
    ? false // ID == ID<any> != ID<'File'>
    : IDType extends 'File'
    ? true
    : false
  : false;

/**
 * Only props of T that can be written directly to DB
 */
export type DbChanges<T> = DbAllowableChanges<T> &
  Partial<Record<Exclude<keyof T, keyof DbAllowableChanges<T>>, never>>;

type DbAllowableChanges<T> = {
  [K in Exclude<
    ConditionalKeys<Required<T>, MaybeSecured<NativeDbValue | LinkTo<any>>>,
    keyof Resource
  >]?: UnwrapSecured<T[K]> | Variable;
};

type AndModifiedAt<T> = T extends { modifiedAt: DateTime }
  ? Pick<T, 'modifiedAt'>
  : unknown;

/**
 * Given the existing object and proposed changes, return only the changes
 * that are actually different from the current values.
 *
 * Note that while ID properties to change a relationship can be passed in they
 * are assumed to always be different.
 */
export const getChanges =
  <TResourceStatic extends ResourceShape<any>>(resource: TResourceStatic) =>
  <
    TResource extends MaybeUnsecuredInstance<TResourceStatic>,
    Changes extends AnyChangesOf<TResource>,
  >(
    existingObject: TResource,
    changes: Changes &
      // Ensure there are no extra props not in ChangesOf<TResource>
      // This is needed because changes is a generic.
      // It's a generic to ensure that if only a subset of the changes
      // are passed in we don't declare the return type having those omitted
      // properties.
      Record<Exclude<keyof Changes, keyof AnyChangesOf<TResource>>, never>,
  ): ChangesOf<TResource, Changes> => {
    const res = EnhancedResource.of(resource);
    const baseImmutable = [...EnhancedResource.of(Resource).props];
    const actual = pickBy(omit(changes, baseImmutable), (change, prop) => {
      if (change === undefined) {
        return false;
      }
      const key = isRelation(res, prop) ? prop.slice(0, -2) : prop;
      let existing = unwrapSecured(existingObject[key]);
      // Unwrap existing LinkTo to input ID.
      if (
        typeof change === 'string' &&
        existing &&
        typeof existing === 'object' &&
        typeof existing.id === 'string'
      ) {
        existing = existing.id;
      }
      // Unwrap existing LinkTo[] to input ID[].
      if (
        Array.isArray(change) &&
        typeof change[0] === 'string' &&
        Array.isArray(existing) &&
        typeof existing[0] === 'object' &&
        typeof existing[0].id === 'string'
      ) {
        existing = existing.map(({ id }) => id);
      }
      return !isSame(change, existing);
    });

    if (
      Object.keys(actual).length > 0 &&
      res.props.has('modifiedAt') &&
      !(actual as any).modifiedAt
    ) {
      return {
        ...(actual as any),
        modifiedAt: DateTime.local(),
      };
    }
    return actual as any;
  };

/**
 * If prop ends with `Id` and resource has `x` instead of `xId`, assume
 * it is a relation and the current value is the ID of the relation.
 * This is our convention in order to lazily hydrate them.
 */
export const isRelation = <TResourceStatic extends ResourceShape<any>>(
  resource: EnhancedResource<TResourceStatic>,
  prop: string,
) =>
  !resource.props.has(prop) &&
  prop.endsWith('Id') &&
  resource.props.has(prop.slice(0, -2));

export const compareNullable =
  <T>(fn: (a: T, b: T) => boolean) =>
  (a: T | null | undefined, b: T | null | undefined) => {
    if (a == null && b == null) {
      return true;
    }
    if ((a == null && b) || (a && b == null)) {
      return false;
    }
    return fn(a!, b!);
  };

export const isSame = compareNullable((a: unknown, b: unknown) => {
  if (DateTime.isDateTime(a) || DateTime.isDateTime(b)) {
    return +(a as number) === +(b as number);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      entries(difference(a, b)).length === 0 &&
      entries(difference(b, a)).length === 0
    );
  }
  return a === b;
});

/**
 * Given a comparator, return a function that returns the input value if it's
 * different from the previous value, else undefined "as unchanged".
 */
export const ifDiff =
  <T>(comparator: (a: T, b: T) => boolean) =>
  (input: T | undefined, previous: T) =>
    input !== undefined && !comparator(input, previous) ? input : undefined;
