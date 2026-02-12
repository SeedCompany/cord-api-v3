import type { SetRequired } from 'type-fest';

/**
 * Used for generic GraphQL types
 * @deprecated Use AbstractClass from type-fest
 */
export type AbstractClassType<T> = (abstract new (...args: any[]) => T) & {
  prototype: T;
};

export interface Range<T> {
  start: T;
  end: T;
}

/**
 * Useful to _implement_ existing class, ignoring private/protected members.
 */
export type PublicOf<T> = { [P in keyof T]: T[P] };

export type AllRequired<T> = SetRequired<T, keyof T>;
