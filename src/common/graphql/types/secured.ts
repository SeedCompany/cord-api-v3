import { isObjectLike } from '@seedcompany/common';
import type { ConditionalKeys, ConditionalPick } from 'type-fest';

export interface Secured<T> {
  readonly value?: T;
  readonly canRead: boolean;
  readonly canEdit: boolean;
}

export type SecuredProps<Dto extends Record<string, any>> = ConditionalPick<
  Dto,
  Secured<any>
>;

export type SecuredKeys<Dto extends Record<string, any>> = ConditionalKeys<
  Dto,
  Secured<any>
>;

export type MaybeSecured<Dto> = Dto | UnsecuredDto<Dto>;

export type MaybeSecuredProp<T> = T | Secured<T>;

/**
 * Converts a DTO to unwrap its secured properties.
 * Non-secured properties are left as is.
 *
 * So:
 * ```tsx
 * {
 *   foo: SecuredString;
 *   bar: DateTime;
 * }
 * ```
 * Becomes:
 * ```tsx
 * {
 *   foo: string;
 *   bar: DateTime;
 * }
 * ```
 */
export type UnsecuredDto<Dto> = {
  [K in keyof Dto as Exclude<K, 'canDelete'>]: UnwrapSecured<Dto[K]>;
};

/**
 * Specify this on a property to override the value type for UnsecuredDto on
 * the object.
 *
 * @example
 * class Foo {
 *   color: string & SetUnsecuredType<number>
 * }
 * const unsecured: UnsecuredDto<Foo> = {
 *   hexColor: 0xFFFFFF,
 * };
 */
export interface SetUnsecuredType<Value> {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- shush we are hiding this. It's only for TS types.
  __unsecured_type__?: Value;
}

export type UnwrapSecured<T> =
  T extends SetUnsecuredType<infer Override>
    ? Override
    : T extends Secured<infer P>
      ? P
      : T;

export const isSecured = <T>(value: T | Secured<T>): value is Secured<T> =>
  isObjectLike(value) && 'canRead' in value && 'canEdit' in value;

export const unwrapSecured = <T>(value: T | Secured<T>): T | undefined =>
  isSecured(value) ? value.value : value;
