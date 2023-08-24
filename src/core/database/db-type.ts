import { UnwrapSecured } from '~/common';

/**
 * Specify this on a property to override the key & value type for DbTypeOf on
 * the object.
 *
 * @example
 * class Foo {
 *   color: string & SetDbType<'hexColor', number>
 * }
 * const changes: DbTypeOf<Foo> = {
 *   hexColor: 0xFFFFFF,
 * };
 */
export interface SetDbType<Value> {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- shush we are hiding this. It's only for TS types.
  __db_type__?: Value;
}

export type DbTypeOf<Dto> = {
  [K in keyof Dto as Exclude<K, 'canDelete'>]: DbValueOf<Dto[K]>;
};

type DbValueOf<Val> = Val extends SetDbType<infer Override>
  ? Override
  : UnwrapSecured<Val>;
